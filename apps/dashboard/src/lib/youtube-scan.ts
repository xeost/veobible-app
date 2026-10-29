import {
  cacheVideos,
  detectVideos,
  videoMetadata,
  type PendingProject,
} from "./website-youtube";
import {
  catalogUrl,
  parseCatalog,
  parseWatchDate,
  validChannel,
  type CatalogPage,
} from "./youtube-html";
const delayMs = 5000,
  leaseMs = 90000,
  blockedMs = 15 * 60 * 1000,
  negativeCacheMs = 60000;
type Stream = {
  pages?: number;
  continuation?: string;
  context?: CatalogPage["context"];
  visited?: boolean;
  exhausted?: boolean;
};
type Scan = {
  targets: string[];
  scope: string;
  at: number;
  run: string;
  requests: number;
  streams: { videos?: Stream; shorts?: Stream };
};
const keyFor = (channel: string) => `youtube_scan:${channel}`;
const targetKey = (p: PendingProject) =>
  JSON.stringify([
    p.id,
    p.title,
    p.passage,
    p.locale,
    p.version,
    p.youtube_title,
  ]);
export type ScanResult = {
  projects: number;
  books: number;
  ambiguous: number;
  imported: number;
  pending: number;
  more: boolean;
  retryAfterMs?: number;
  state: "searching" | "done" | "paused" | "waiting";
  note?:
    | "not-found"
    | "blocked"
    | "ambiguous"
    | "limit"
    | "unreadable"
    | "templates";
};
type Runtime = {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  fetch: typeof fetch;
};
const runtime: Runtime = {
  now: Date.now,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  fetch: (...args) => fetch(...args),
};
async function read<T>(db: D1Database, key: string): Promise<T | null> {
  const row = await db
    .prepare("SELECT value FROM site_settings WHERE key=?")
    .bind(key)
    .first<{ value: string }>();
  return row ? JSON.parse(row.value) : null;
}
async function save(db: D1Database, key: string, value: unknown) {
  await db
    .prepare(
      "INSERT INTO site_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP",
    )
    .bind(key, JSON.stringify(value))
    .run();
}
async function claim(db: D1Database, now: number) {
  const owner = crypto.randomUUID();
  const value = JSON.stringify({
    owner,
    leaseUntil: now + leaseMs,
    notBefore: now + delayMs,
  });
  const row = await db
    .prepare(
      `INSERT INTO site_settings(key,value) VALUES('youtube_fetch_gate',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE coalesce(json_extract(site_settings.value,'$.leaseUntil'),0)<=? AND coalesce(json_extract(site_settings.value,'$.notBefore'),0)<=? RETURNING key`,
    )
    .bind(value, now, now)
    .all();
  return row.results.length ? owner : null;
}
async function release(db: D1Database, owner: string, notBefore: number) {
  await db
    .prepare(
      "UPDATE site_settings SET value=? WHERE key='youtube_fetch_gate' AND json_extract(value,'$.owner')=?",
    )
    .bind(JSON.stringify({ leaseUntil: 0, notBefore }), owner)
    .run();
}
export async function scanYouTube(
  db: D1Database,
  channel: string,
  run: string,
  overrides: Partial<Runtime> = {},
): Promise<ScanResult> {
  if (!validChannel(channel)) throw new Error("Invalid channel");
  const rt = { ...runtime, ...overrides };
  let matches = await detectVideos(db, channel);
  const base = () => ({
    projects: matches.projects,
    books: matches.books,
    ambiguous: matches.ambiguous,
    imported: 0,
    pending: matches.pending,
  });
  if (matches.more) return { ...base(), state: "searching", more: true };
  if (!matches.pending) return { ...base(), state: "done", more: false };
  if (!matches.searchable.length && !matches.verify)
    return {
      ...base(),
      state: "paused",
      note: matches.missingTemplates ? "templates" : "ambiguous",
      more: false,
    };
  const now = rt.now();
  const gate = await read<{ leaseUntil: number; notBefore: number }>(
    db,
    "youtube_fetch_gate",
  );
  if (gate && gate.notBefore > now && gate.leaseUntil <= now)
    return { ...base(), state: "paused", note: "blocked", more: false };
  const owner = await claim(db, now);
  if (!owner)
    return { ...base(), state: "waiting", more: true, retryAfterMs: delayMs };
  let backoff = 0;
  try {
    // Another run may have filled the cache while this request waited for the lock.
    const refreshed = await detectVideos(db, channel);
    matches = {
      ...refreshed,
      projects: matches.projects + refreshed.projects,
      books: matches.books + refreshed.books,
    };
    if (refreshed.more) return { ...base(), state: "searching", more: true };
    if (!refreshed.pending) return { ...base(), state: "done", more: false };
    if (!refreshed.searchable.length && !refreshed.verify)
      return {
        ...base(),
        state: "paused",
        note: matches.missingTemplates ? "templates" : "ambiguous",
        more: false,
      };
    const scope = JSON.stringify(matches.sources);
    let scan = await read<Scan>(db, keyFor(channel));
    const targets = matches.searchable.map(targetKey);
    if (
      !scan ||
      scan.scope !== scope ||
      targets.some((t) => !scan!.targets.includes(t))
    )
      scan = { scope, targets, at: now, run, requests: 0, streams: {} };
    if (scan.run !== run) {
      if (now - scan.at < negativeCacheMs && !matches.verify)
        return { ...base(), state: "paused", note: "not-found", more: false };
      const resumable =
        scan.requests >= 20 &&
        now - scan.at < 15 * 60 * 1000 &&
        Object.values(scan.streams).some(
          (stream) => stream.visited && !stream.exhausted,
        );
      scan = resumable
        ? { ...scan, run, requests: 0 }
        : { scope, targets, at: now, run, requests: 0, streams: {} };
    }
    if (scan.requests >= 20)
      return { ...base(), state: "paused", note: "limit", more: false };
    const verify = matches.verify;
    let tab: "videos" | "shorts" | undefined;
    if (!verify) {
      const needed = (["shorts", "videos"] as const).filter((t) =>
        matches.searchable.some((p) =>
          t === "shorts" ? p.kind === "short" : p.kind !== "short",
        ),
      );
      // Check both recent catalogs before walking deeper into either one.
      const pages = (t: "videos" | "shorts") =>
        scan!.streams[t]?.pages ?? (scan!.streams[t]?.visited ? 1 : 0);
      tab = needed
        .filter((t) => !scan!.streams[t]?.exhausted)
        .sort((a, b) => pages(a) - pages(b))[0];
      if (!tab)
        return { ...base(), state: "paused", note: "not-found", more: false };
    }
    const stream = tab ? (scan.streams[tab] ?? {}) : undefined;
    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0",
      "Accept-Language": "en-US,en;q=0.9",
    };
    const url = verify
      ? `https://www.youtube.com/watch?v=${verify.youtube_id}&hl=en`
      : stream?.visited
        ? "https://www.youtube.com/youtubei/v1/browse?prettyPrint=false"
        : catalogUrl(channel, tab!);
    // Workers support "manual" and "follow"; reject redirects through !response.ok
    // without following consent pages or unexpected destinations.
    const options: RequestInit = { headers, redirect: "manual" };
    if (!verify && stream?.visited) {
      if (!stream.continuation || !stream.context) {
        scan.streams[tab!] = { ...stream, exhausted: true };
        await save(db, keyFor(channel), scan);
        return { ...base(), state: "searching", more: true };
      }
      options.method = "POST";
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify({
        context: stream.context,
        continuation: stream.continuation,
      });
    }
    // The shared lease spans delay + fetch + cache commit, across all channels and Workers.
    await rt.sleep(delayMs);
    let response: Response;
    try {
      response = await rt.fetch(url, {
        ...options,
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      backoff = negativeCacheMs;
      return { ...base(), state: "paused", note: "unreadable", more: false };
    }
    scan.requests++;
    scan.at = rt.now();
    if (!response.ok) {
      backoff = [403, 429, 503].includes(response.status)
        ? blockedMs
        : negativeCacheMs;
      return {
        ...base(),
        state: "paused",
        note: [403, 429, 503].includes(response.status)
          ? "blocked"
          : "unreadable",
        more: false,
      };
    }
    let body: string;
    try {
      body = await response.text();
    } catch {
      backoff = negativeCacheMs;
      return { ...base(), state: "paused", note: "unreadable", more: false };
    }
    if (
      body.length > 8 * 1024 * 1024 ||
      /unusual traffic|confirm you(?:'|&#39;)re not a bot|consent\.youtube\.com/i.test(
        body,
      )
    ) {
      backoff = blockedMs;
      return { ...base(), state: "paused", note: "blocked", more: false };
    }
    let imported = 0;
    if (verify) {
      const published = parseWatchDate(body, verify.youtube_id);
      const metadata = { ...videoMetadata(verify), dateChecked: true };
      await db
        .prepare(
          "UPDATE social_video_cache SET published_at=?,metadata=? WHERE platform='youtube' AND video_id=?",
        )
        .bind(published, JSON.stringify(metadata), verify.youtube_id)
        .run();
    } else {
      let page: CatalogPage;
      try {
        page = parseCatalog(
          options.method === "POST" ? JSON.parse(body) : body,
          channel,
          tab!,
          rt.now(),
        );
      } catch {
        backoff = negativeCacheMs;
        return { ...base(), state: "paused", note: "unreadable", more: false };
      }
      if (!page.videos.length && !page.continuation) {
        backoff = negativeCacheMs;
        return { ...base(), state: "paused", note: "unreadable", more: false };
      }
      imported = await cacheVideos(db, page.videos);
      scan.streams[tab!] = {
        pages: (stream?.pages ?? (stream?.visited ? 1 : 0)) + 1,
        visited: true,
        continuation: page.continuation,
        context: page.context ?? stream?.context,
        exhausted:
          !page.continuation || page.continuation === stream?.continuation,
      };
    }
    await save(db, keyFor(channel), scan);
    const after = await detectVideos(db, channel);
    matches = {
      ...after,
      projects: matches.projects + after.projects,
      books: matches.books + after.books,
    };
    return {
      ...base(),
      imported,
      more: after.pending > 0,
      state: after.pending ? "searching" : "done",
    };
  } finally {
    await release(db, owner, rt.now() + backoff);
  }
}
