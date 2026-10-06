#!/usr/bin/env python3
"""
import-youtube-videos.py

This script automatically fetches the latest videos from configured YouTube channels
via RSS feeds and updates the corresponding Bible version's index.json files.
For each book, it looks for a video title matching the book name.
If a match is found, the video URL is saved to the book's "video" field if it's currently empty.
"""

import os
import re
import sys
import json
import time
import urllib.request
import xml.etree.ElementTree as ET
import unicodedata
import datetime

# ==============================================================================
# Configuration
# ==============================================================================

# List of configurations mapping a Bible version directory (relative to project root)
# to its corresponding YouTube channel URL.
# Each entry maps a Bible version directory to its YouTube channel and the date
# (YYYY-MM-DD) of the first uploaded video for that version ("base_date").
# Videos published before base_date are ignored for that version.
# When a channel hosts multiple versions sequentially, the version with the
# highest base_date that is still <= the video's publish date wins.
CONFIG = [
    # --- Spanish channel ---
    {
        "bible_data_path": "public/bible-data/es/rv1909",
        "youtube_channel": "https://www.youtube.com/@veobible-es",
        "base_date": "2026-05-26",
        "disabled": False,  # Set to True once all videos for this version are detected
    },
    {
        "bible_data_path": "public/bible-data/es/spabll",
        "youtube_channel": "https://www.youtube.com/@veobible-es",
        "base_date": "2026-08-10",
        "disabled": False,
    },
    # --- English channel ---
    {
        "bible_data_path": "public/bible-data/en/kjv",
        "youtube_channel": "https://www.youtube.com/@veobible",
        "base_date": "2026-05-27",
        "disabled": False,
    },
    {
        "bible_data_path": "public/bible-data/en/web",
        "youtube_channel": "https://www.youtube.com/@veobible",
        "base_date": "2026-08-10",
        "disabled": False,
    },
    # --- Portuguese channel ---
    {
        "bible_data_path": "public/bible-data/pt/arc",
        "youtube_channel": "https://www.youtube.com/@veobible-pt",
        "base_date": "2026-07-23",
        "disabled": False,
    },
]

# Time delay (in seconds) between requests to respect YouTube rate limits
REQUEST_DELAY_SECONDS = 2

# ==============================================================================

def normalize_text(text):
    """
    Normalizes text for comparison: lowercases, strips whitespace, and removes diacritics.
    """
    if not text:
        return ""
    nfkd_form = unicodedata.normalize('NFKD', text)
    return "".join([c for c in nfkd_form if not unicodedata.combining(c)]).lower().strip()

def get_channel_id(channel_url):
    """
    Fetches the YouTube channel page and extracts the channel ID (UC...).
    """
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    req = urllib.request.Request(channel_url, headers=headers)
    try:
        with urllib.request.urlopen(req) as response:
            html = response.read().decode('utf-8', errors='ignore')
            # Extract channel ID using common patterns in YouTube HTML
            match = re.search(r'itemprop="channelId"\s+content="([^"]+)"', html)
            if match:
                return match.group(1)
            match = re.search(r'"channelId":"([^"]+)"', html)
            if match:
                return match.group(1)
            match = re.search(r'youtube.com/channel/(UC[a-zA-Z0-9_-]{22})', html)
            if match:
                return match.group(1)
    except Exception as e:
        print(f"Error fetching channel page {channel_url}: {e}", file=sys.stderr)
    return None

def fetch_rss_videos(channel_id):
    """
    Fetches the RSS feed for a channel and returns a list of videos as dictionaries:
    [{'title': ..., 'url': ..., 'published': ...}]
    """
    rss_url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    req = urllib.request.Request(rss_url, headers=headers)
    videos = []
    try:
        with urllib.request.urlopen(req) as response:
            xml_data = response.read()
            root = ET.fromstring(xml_data)
            
            # XML Namespaces in YouTube RSS feeds
            ns = {
                'atom': 'http://www.w3.org/2005/Atom',
                'yt': 'http://www.youtube.com/xml/schemas/2015'
            }
            
            for entry in root.findall('atom:entry', ns):
                title_elem = entry.find('atom:title', ns)
                video_id_elem = entry.find('yt:videoId', ns)
                published_elem = entry.find('atom:published', ns)
                
                if title_elem is not None and video_id_elem is not None:
                    title = title_elem.text
                    video_id = video_id_elem.text
                    published = published_elem.text if published_elem is not None else ""
                    videos.append({
                        'title': title,
                        'url': f"https://www.youtube.com/watch?v={video_id}",
                        'published': published
                    })
    except Exception as e:
        print(f"Error fetching/parsing RSS feed for channel ID {channel_id}: {e}", file=sys.stderr)
    return videos

def extract_pub_text(seg):
    """
    Extracts the relative publication time text from the segment.
    """
    matches = re.findall(r'\"content\"\s*:\s*\"([^\"]+)\"', seg)
    time_keywords = [
        'hace', 'ago', 'hour', 'hora', 'day', 'dia', 'día', 'week', 'semana', 'sem',
        'month', 'mes', 'year', 'año', 'ano', 'yesterday', 'ayer', 'today', 'hoy',
        'transmitido', 'streamed'
    ]
    for m in matches:
        m_lower = m.lower()
        if any(kw in m_lower for kw in time_keywords):
            return m
    return ""

def parse_relative_date(text):
    """
    Parses a relative date string (e.g., 'hace 12 h', '2 days ago') and returns YYYY-MM-DD.
    """
    today = datetime.date.today()
    text = text.lower().strip()
    text = text.replace("hace", "").replace("ago", "").strip()
    
    if text in ("today", "hoy", "just now", "ahora mismo"):
        return today.isoformat()
    if text in ("yesterday", "ayer"):
        return (today - datetime.timedelta(days=1)).isoformat()
        
    # Find number in the string
    match = re.search(r'(\d+)', text)
    if not match:
        if any(w in text for w in ["un", "una", "a ", "an "]):
            val = 1
        else:
            return today.isoformat()
    else:
        val = int(match.group(1))
        
    # Determine unit
    days = 0
    if re.search(r'\b(h|hora|horas|hour|hours|hr|hrs)\b', text):
        days = 0
    elif re.search(r'\b(d|dia|días|dias|day|days)\b', text):
        days = val
    elif re.search(r'\b(sem|semana|semanas|wk|wks|week|weeks)\b', text):
        days = val * 7
    elif re.search(r'\b(mes|meses|month|months)\b', text):
        days = val * 30
    elif re.search(r'\b(ano|año|años|anos|year|years|yr|yrs)\b', text):
        days = val * 365
        
    calc_date = today - datetime.timedelta(days=days)
    return calc_date.isoformat()

def fetch_videos_from_channel(channel_url, channel_id=None):
    """
    Fetches videos from the YouTube channel HTML page (Videos tab),
    falling back to RSS feed if that fails.
    """
    videos = []
    
    # 1. Try HTML videos tab parsing
    try:
        videos_url = channel_url.rstrip('/') + '/videos'
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
        }
        req = urllib.request.Request(videos_url, headers=headers)
        with urllib.request.urlopen(req) as response:
            html = response.read().decode('utf-8', errors='ignore')
            
        segments = html.split('lockupViewModel')
        for seg in segments[1:]:
            vid_match = re.search(r'\"videoId\"\s*:\s*\"([^\"]+)\"', seg)
            if not vid_match:
                vid_match = re.search(r'\"contentId\"\s*:\s*\"([^\"]+)\"', seg)
            title_match = re.search(r'\"title\"\s*:\s*{\s*\"content\"\s*:\s*\"([^\"]+)\"', seg)
            
            vid = vid_match.group(1) if vid_match else None
            title = title_match.group(1) if title_match else None
            
            if vid and title:
                pub_text = extract_pub_text(seg)
                pub_date = parse_relative_date(pub_text)
                
                videos.append({
                    'title': title,
                    'url': f"https://www.youtube.com/watch?v={vid}",
                    'published': pub_date
                })
                
        if videos:
            print(f"Successfully scraped {len(videos)} videos from channel HTML page.")
            return videos
            
    except Exception as e:
        print(f"Warning: Failed to fetch/parse videos from HTML page: {e}. Falling back to RSS.", file=sys.stderr)
        
    # 2. Fallback to RSS feed if we have channel ID
    if channel_id:
        print("Attempting to fetch videos via YouTube RSS feed fallback...")
        return fetch_rss_videos(channel_id)
        
    return []

def match_video_to_book(video_title, book_name):
    """
    Matches a video title to a Bible book name.
    Expects that the video title contains the book name in its first pipe-separated segment,
    or falls back to an exact match if no pipe is present.
    """
    norm_book = normalize_text(book_name)
    
    if '|' in video_title:
        first_segment = video_title.split('|')[0]
        if normalize_text(first_segment) == norm_book:
            return True
    else:
        if normalize_text(video_title) == norm_book:
            return True
            
    return False

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    
    print("Starting YouTube Bible Video Integrator Script")
    print("-" * 60)
    
    # Build a map: channel_url -> sorted list of (base_date, config_item) so that
    # for a given channel we can quickly determine which version a video belongs to.
    # A video belongs to the version whose base_date is the highest date that is
    # still <= the video's publish date.
    # Only include active (non-disabled) entries in the channel_versions map
    # so that disabled versions don't affect date-range boundaries.
    channel_versions: dict = {}
    for item in CONFIG:
        if item.get("disabled", False):
            continue
        ch = item["youtube_channel"]
        channel_versions.setdefault(ch, []).append(item)
    # Sort each channel's versions by base_date ascending
    for ch in channel_versions:
        channel_versions[ch].sort(key=lambda x: x["base_date"])

    # Cache fetched videos per channel to avoid duplicate HTTP requests
    channel_videos_cache: dict = {}

    for item in CONFIG:
        if item.get("disabled", False):
            print(f"⏭ Skipping disabled version: {entry_dir_label(item['bible_data_path'])}")
            print("-" * 60)
            continue

        bible_path = item["bible_data_path"]
        if not os.path.isabs(bible_path):
            bible_path = os.path.abspath(os.path.join(project_root, bible_path))

        index_path = os.path.join(bible_path, "index.json")
        if not os.path.exists(index_path):
            print(f"Error: index.json not found at {index_path}. Skipping this version.", file=sys.stderr)
            print("-" * 60)
            continue

        channel_url = item["youtube_channel"]
        version_base_date = item["base_date"]
        print(f"Processing version at: {entry_dir_label(bible_path)}")
        print(f"YouTube Channel: {channel_url}")
        print(f"Version base date: {version_base_date}")
        
        # 1. Fetch videos for this channel (use cache to avoid duplicate requests)
        if channel_url not in channel_videos_cache:
            print("Resolving channel ID...")
            channel_id = get_channel_id(channel_url)
            if not channel_id:
                print(f"Warning: Could not resolve channel ID for {channel_url}. Will attempt direct HTML fetching.")
            else:
                print(f"Resolved Channel ID: {channel_id}")

            # Delay before next request
            time.sleep(REQUEST_DELAY_SECONDS)

            print("Fetching latest videos from YouTube...")
            all_videos = fetch_videos_from_channel(channel_url, channel_id)
            print(f"Retrieved {len(all_videos)} videos for channel.")
            channel_videos_cache[channel_url] = all_videos
        else:
            all_videos = channel_videos_cache[channel_url]
            print(f"Using cached {len(all_videos)} videos for channel.")

        # 2. Determine which videos belong to this version.
        # A video belongs to this version if its publish date >= version_base_date
        # AND it does not belong to a newer version on the same channel.
        # "Newer version" means a version whose base_date > this version's base_date
        # AND that base_date <= the video's publish date.
        channel_version_dates = [v["base_date"] for v in channel_versions[channel_url]]

        def video_belongs_to_version(pub_date_str, this_base_date):
            """Returns True if pub_date_str falls in the range owned by this_base_date."""
            if pub_date_str[:10] < this_base_date:
                return False
            # Check if any later version has a base_date <= pub_date (that would claim this video)
            for bd in channel_version_dates:
                if bd > this_base_date and pub_date_str[:10] >= bd:
                    return False
            return True

        videos = [
            v for v in all_videos
            if video_belongs_to_version(v["published"], version_base_date)
        ]
        print(f"{len(videos)} video(s) matched to this version (base_date >= {version_base_date}).")

        if not videos:
            print("No videos matched for this version. Skipping.")
            print("-" * 60)
            continue
            
        # 3. Load index.json
        try:
            with open(index_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except Exception as e:
            print(f"Error loading {index_path}: {e}", file=sys.stderr)
            print("-" * 60)
            continue
            
        if "books" not in data or not isinstance(data["books"], list):
            print(f"Error: 'books' array not found in {index_path}. Skipping version.", file=sys.stderr)
            print("-" * 60)
            continue
            
        # 4. Process and match videos
        modified = False
        updates_count = 0

        # We process videos already filtered to this version's date range
        for video in videos:
            pub_date = video['published']
                
            title = video['title']
            url = video['url']
            
            # Find matching book
            for book in data["books"]:
                book_name = book.get("name", "")
                if match_video_to_book(title, book_name):
                    current_video = book.get("video", "")
                    if current_video == "":
                        book["video"] = url
                        modified = True
                        updates_count += 1
                        print(f"  ✔ Matched and updated: '{book_name}' -> {url} (Published: {pub_date[:10]})")
                    elif current_video == url:
                        print(f"  – Already up to date: '{book_name}' has the correct video URL.")
                    else:
                        print(f"  ⚠ Conflict: '{book_name}' already has video '{current_video}' (found video: '{url}'). Skipping.")
                    break
                    
        # 5. Save index.json if modified
        if modified:
            try:
                with open(index_path, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
                    f.write('\n')
                print(f"✔ Successfully saved updates to {index_path} ({updates_count} books updated).")
            except Exception as e:
                print(f"Error writing to {index_path}: {e}", file=sys.stderr)
        else:
            print("No new video URL updates to save.")
            
        print("-" * 60)
        
        # Delay between channels
        time.sleep(REQUEST_DELAY_SECONDS)

def entry_dir_label(path):
    """
    Helper to print nice relative paths for logs.
    """
    parts = path.split(os.sep)
    if len(parts) >= 2:
        return os.path.join(*parts[-2:])
    return path

if __name__ == "__main__":
    main()
