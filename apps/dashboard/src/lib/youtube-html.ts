/** Public YouTube catalog HTML; no developer API key or RSS dependency. */
export type VideoMetadata = {
  publishedRange?: { start: string; end: string };
  tab?: "videos" | "shorts";
  dateChecked?: boolean;
};
export type CatalogVideo = {
  youtube_id: string;
  title: string;
  published_at: string;
  description: string;
  channel: string;
  metadata?: VideoMetadata;
};
export type CatalogPage = {
  videos: CatalogVideo[];
  continuation?: string;
  context?: {
    client: {
      clientName: string;
      clientVersion: string;
      hl?: string;
      gl?: string;
      visitorData?: string;
    };
  };
};
const idPattern = /^[A-Za-z0-9_-]{11}$/;
function text(value: any): string {
  return typeof value === "string"
    ? value
    : (value?.simpleText ??
        value?.content ??
        (Array.isArray(value?.runs)
          ? value.runs.map((r: any) => r.text ?? "").join("")
          : ""));
}
function jsonAt(html: string, start: number): any {
  let depth = 0,
    quoted = false,
    escaped = false;
  for (let i = start; i < html.length; i++) {
    const char = html[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === "{") depth++;
    if (char === "}" && --depth === 0) {
      try {
        return JSON.parse(html.slice(start, i + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}
export function embeddedJson(html: string, name: string): any {
  const pattern = new RegExp(
    `(?:var\\s+)?${name}\\s*=\\s*|window\\["${name}"\\]\\s*=\\s*`,
    "g",
  );
  for (const match of html.matchAll(pattern)) {
    const i = html.indexOf("{", match.index! + match[0].length);
    if (i >= 0) {
      const value = jsonAt(html, i);
      if (value) return value;
    }
  }
  return null;
}
function config(html: string): any {
  let result = {};
  for (const match of html.matchAll(/ytcfg\.set\(\s*/g)) {
    const value = jsonAt(
      html,
      html.indexOf("{", match.index! + match[0].length),
    );
    if (value) result = { ...result, ...value };
  }
  return result;
}
export function relativePublicationRange(
  value: string,
  now: number,
): VideoMetadata["publishedRange"] {
  const normalized = value
    .toLowerCase()
    .replace(/^streamed\s+|^premiered\s+/g, "")
    .trim();
  const expanded = normalized.replace(
    /^(\d+)\s*(s|sec|min|m|h|hr|d|w|wk|mo|y|yr)\s+ago$/,
    (_, n, unit) =>
      `${n} ${{ s: "second", sec: "second", min: "minute", m: "minute", h: "hour", hr: "hour", d: "day", w: "week", wk: "week", mo: "month", y: "year", yr: "year" }[unit as string]}s ago`,
  );
  const match = expanded.match(
    /^(\d+|a|an)\s+(second|minute|hour|day|week|month|year)s?\s+ago/,
  );
  if (!match) return undefined;
  const count = /^a/.test(match[1]) ? 1 : Number(match[1]);
  const day = 86400000;
  const units: Record<string, [number, number]> = {
    second: [1000, 1000],
    minute: [60000, 60000],
    hour: [3600000, 3600000],
    day: [day, day],
    week: [7 * day, 7 * day],
    month: [28 * day, 31 * day],
    year: [365 * day, 366 * day],
  };
  const [min, max] = units[match[2]];
  // Deliberately conservative: rounded labels must not decide a version boundary.
  return {
    start: new Date(now - (count + 1) * max - day).toISOString().slice(0, 10),
    end: new Date(now - count * min + day).toISOString().slice(0, 10),
  };
}
function date(value: unknown): string {
  return typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) &&
    Number.isFinite(Date.parse(value))
    ? value
    : "";
}
export function parseCatalog(
  input: string | object,
  channel: string,
  tab: "videos" | "shorts",
  now = Date.now(),
): CatalogPage {
  const html = typeof input === "string" ? input : null;
  const initial = html ? embeddedJson(html, "ytInitialData") : input;
  if (!initial) throw new Error("YouTube catalog could not be read.");
  const cfg = html ? config(html) : {};
  const rawContext = cfg.INNERTUBE_CONTEXT?.client;
  const clientName =
    rawContext?.clientName ??
    (cfg.INNERTUBE_CLIENT_NAME === 1 ? "WEB" : undefined);
  const clientVersion =
    rawContext?.clientVersion ?? cfg.INNERTUBE_CLIENT_VERSION;
  const context =
    clientName && clientVersion
      ? {
          client: {
            clientName: String(clientName),
            clientVersion: String(clientVersion),
            hl: "en",
            gl: "US",
            ...(rawContext?.visitorData
              ? { visitorData: rawContext.visitorData }
              : {}),
          },
        }
      : undefined;
  const tabs = initial.contents?.twoColumnBrowseResultsRenderer?.tabs;
  const selected = tabs?.find((t: any) => t.tabRenderer?.selected)?.tabRenderer;
  const root = selected?.content ?? initial;
  const videos = new Map<string, CatalogVideo>();
  let continuation: string | undefined;
  const visit = (node: any) => {
    if (!node || typeof node !== "object") return;
    const token =
      node.continuationItemRenderer?.continuationEndpoint?.continuationCommand
        ?.token ?? node.nextContinuationData?.continuation;
    if (typeof token === "string" && token.length < 20000) continuation = token;
    const renderer =
      node.videoRenderer ?? node.gridVideoRenderer ?? node.reelItemRenderer;
    const lockup = node.lockupViewModel;
    const short = node.shortsLockupViewModel;
    const id =
      renderer?.videoId ??
      lockup?.contentId ??
      short?.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId ??
      short?.onTap?.innertubeCommand?.watchEndpoint?.videoId;
    const title = text(
      renderer?.title ??
        renderer?.headline ??
        lockup?.metadata?.lockupMetadataViewModel?.title ??
        short?.overlayMetadata?.primaryText,
    );
    if (idPattern.test(id ?? "") && title) {
      const metadata =
        lockup?.metadata?.lockupMetadataViewModel?.metadata
          ?.contentMetadataViewModel?.metadataRows ?? [];
      const relative =
        text(renderer?.publishedTimeText) ||
        metadata
          .flatMap((r: any) => r.metadataParts ?? [])
          .map((p: any) => p.accessibilityLabel || text(p.text))
          .find((s: string) => /\bago\b/.test(s)) ||
        "";
      const published = date(
        renderer?.publishedAt ?? renderer?.publishDate ?? lockup?.publishedAt,
      );
      if (!videos.has(id))
        videos.set(id, {
          youtube_id: id,
          title,
          published_at: published,
          description: text(renderer?.descriptionSnippet),
          channel,
          metadata: {
            tab,
            ...(!published && relativePublicationRange(relative, now)
              ? { publishedRange: relativePublicationRange(relative, now) }
              : {}),
          },
        });
      return;
    }
    for (const value of Object.values(node))
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object") visit(value);
  };
  visit(root);
  return { videos: [...videos.values()], continuation, context };
}
export function parseWatchDate(html: string, videoId: string): string {
  const player = embeddedJson(html, "ytInitialPlayerResponse");
  if (player?.videoDetails?.videoId && player.videoDetails.videoId !== videoId)
    return "";
  const micro = player?.microformat?.playerMicroformatRenderer;
  const found = date(micro?.publishDate ?? micro?.uploadDate);
  if (found) return found;
  for (const tag of html.matchAll(/<meta\s[^>]*>/gi)) {
    if (
      !/(?:itemprop|property)=["'](?:datePublished|uploadDate)["']/i.test(
        tag[0],
      )
    )
      continue;
    const value = tag[0].match(/content=["']([^"']+)["']/i)?.[1];
    if (date(value)) return date(value);
  }
  return "";
}
export const validChannel = (channel: string) =>
  /^(@[\p{L}\p{N}_.-]{1,100}|UC[\w-]{22})$/u.test(channel);
export function catalogUrl(channel: string, tab: "videos" | "shorts") {
  if (!validChannel(channel)) throw new Error("Invalid channel");
  return `https://www.youtube.com/${channel.startsWith("@") ? encodeURI(channel) : "channel/" + channel}/${tab}?view=0&sort=dd&flow=grid&hl=en`;
}
