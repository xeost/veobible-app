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
CONFIG = [
    {
        "bible_data_path": "public/bible-data/es/rv1909",
        "youtube_channel": "https://www.youtube.com/@veobible-es"
    },
    {
        "bible_data_path": "public/bible-data/en/kjv",
        "youtube_channel": "https://www.youtube.com/@veobible"
    }
]

# Only consider videos published on or after this date (YYYY-MM-DD)
MIN_PUBLISH_DATE = "2026-05-26"

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
    print(f"Filtering videos published on/after: {MIN_PUBLISH_DATE}")
    print("-" * 60)
    
    for item in CONFIG:
        bible_path = item["bible_data_path"]
        if not os.path.isabs(bible_path):
            bible_path = os.path.abspath(os.path.join(project_root, bible_path))
            
        index_path = os.path.join(bible_path, "index.json")
        if not os.path.exists(index_path):
            print(f"Error: index.json not found at {index_path}. Skipping this version.", file=sys.stderr)
            print("-" * 60)
            continue
            
        channel_url = item["youtube_channel"]
        print(f"Processing version at: {entry_dir_label(bible_path)}")
        print(f"YouTube Channel: {channel_url}")
        
        # 1. Resolve Channel ID
        print("Resolving channel ID...")
        channel_id = get_channel_id(channel_url)
        if not channel_id:
            print(f"Warning: Could not resolve channel ID for {channel_url}. Will attempt direct HTML fetching.")
        else:
            print(f"Resolved Channel ID: {channel_id}")
        
        # Delay before next request
        time.sleep(REQUEST_DELAY_SECONDS)
        
        # 2. Fetch latest videos from channel (HTML scraper with RSS fallback)
        print("Fetching latest videos from YouTube...")
        videos = fetch_videos_from_channel(channel_url, channel_id)
        print(f"Retrieved {len(videos)} videos.")
        
        if not videos:
            print("No videos retrieved. Skipping version.")
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
        
        # We process videos from the feed
        for video in videos:
            pub_date = video['published']
            # Check date threshold
            if pub_date[:10] < MIN_PUBLISH_DATE:
                # Video is older than MIN_PUBLISH_DATE, skip it
                continue
                
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
