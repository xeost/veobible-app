const cacheName = "veobible-waveforms-v1";
const maximumBytes = 64 * 1024 * 1024;
const maximumEntries = 32;
type Entry = { bytes: ArrayBuffer; etag: string };
const memory = new Map<string, Entry>();
let writes = Promise.resolve();

export function waveformCacheKey(src: string, resourceKey: string) {
  const url = new URL(src, globalThis.location?.href ?? "http://localhost");
  url.searchParams.delete("mediaToken");
  url.searchParams.sort();
  // Never persist signed access grants, and never key data by their expiry.
  return `https://waveforms.invalid/v1/${encodeURIComponent(JSON.stringify([url.href, resourceKey]))}`;
}

function remember(key: string, entry: Entry) {
  memory.delete(key);
  if (entry.bytes.byteLength > maximumBytes) return;
  memory.set(key, entry);
  let size = [...memory.values()].reduce(
    (total, item) => total + item.bytes.byteLength,
    0,
  );
  while (memory.size > maximumEntries || size > maximumBytes) {
    const oldest = memory.keys().next().value!;
    size -= memory.get(oldest)!.bytes.byteLength;
    memory.delete(oldest);
  }
}

export async function readWaveformCache(
  key: string,
): Promise<Entry | undefined> {
  const hit = memory.get(key);
  if (hit) {
    remember(key, hit);
    return hit;
  }
  try {
    if (typeof caches === "undefined") return;
    const response = await (await caches.open(cacheName)).match(key);
    const etag = response?.headers.get("etag");
    if (!response || !etag) return;
    const entry = { bytes: await response.arrayBuffer(), etag };
    remember(key, entry);
    return entry;
  } catch {
    /* Storage may be disabled or full; preparation still works. */
  }
}

export async function writeWaveformCache(key: string, entry: Entry) {
  remember(key, entry);
  writes = writes
    .catch(() => {})
    .then(async () => {
      if (
        typeof caches === "undefined" ||
        entry.bytes.byteLength > maximumBytes
      )
        return;
      const cache = await caches.open(cacheName);
      await cache.delete(key);
      await cache.put(
        key,
        new Response(entry.bytes, {
          headers: {
            ETag: entry.etag,
            "Content-Length": String(entry.bytes.byteLength),
          },
        }),
      );
      const keys = await cache.keys();
      let size = 0;
      let kept = 0;
      for (const request of [...keys].reverse()) {
        const response = await cache.match(request);
        size += Number(response?.headers.get("content-length") ?? maximumBytes);
        if (++kept > maximumEntries || size > maximumBytes)
          await cache.delete(request);
      }
    });
  await writes.catch(() => {});
}

export async function deleteWaveformCache(key: string) {
  memory.delete(key);
  try {
    if (typeof caches !== "undefined")
      await (await caches.open(cacheName)).delete(key);
  } catch {
    /* Cache failures must not block the editor. */
  }
}
