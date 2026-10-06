import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const q = (v) => (v === null ? "NULL" : `'${String(v).replaceAll("'", "''")}'`);
const sql = [];
const media = [];
async function optional(file) {
  try {
    return await fs.readFile(file, "utf8");
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}
async function settingsFile(dir, names) {
  for (const name of names) {
    const text = await optional(path.join(dir, name));
    if (text) return JSON.parse(text);
  }
  return null;
}
const versions = ["rv1909", "spabll", "kjv", "web", "arc"];
const locales = { rv1909: "es", spabll: "es", kjv: "en", web: "en", arc: "pt" };
for (const kind of ["short", "long"]) {
  const working =
    process.env[
      kind === "short"
        ? "VEOBIBLE_SHORTS_WORKING_DIR"
        : "VEOBIBLE_LONGS_WORKING_DIR"
    ] ??
    path.join(
      process.env.HOME ?? "",
      `Documents/veobible-${kind === "short" ? "shorts" : "longs"}`,
    );
  const outputs =
    process.env[
      kind === "short"
        ? "VEOBIBLE_SHORTS_OUTPUT_DIR"
        : "VEOBIBLE_LONGS_OUTPUT_DIR"
    ] ?? path.join(working, "outputs");
  const catalog = JSON.parse(
    await fs.readFile(
      path.join(
        root,
        "apps/dashboard/resources/catalog",
        kind === "short" ? "popular-verses.json" : "episodes.json",
      ),
      "utf8",
    ),
  );
  const ids = new Set(
    catalog.map((p) =>
      kind === "short" ? p.id : `episode-${String(p.id).padStart(3, "0")}`,
    ),
  );
  const used = JSON.parse(
    (await optional(path.join(outputs, "status.json"))) ?? "{}",
  );
  const records = new Map();
  for (const [key, entry] of Object.entries(used)) {
    if (
      !versions.includes(entry.version) ||
      locales[entry.version] !== entry.locale ||
      !entry.usedAt ||
      !entry.output
    )
      throw new Error(`Invalid status entry ${key}`);
    const id = key.split("/").at(-1);
    if (!ids.has(id)) throw new Error(`Unknown catalog passage ${key}`);
    records.set(`${entry.version}/${id}`, {
      version: entry.version,
      id,
      published: entry.usedAt,
      dir: entry.output,
    });
  }
  for (const version of versions) {
    const dir = path.join(outputs, version);
    const defaults = await settingsFile(dir, ["default-version-settings.json"]);
    if (defaults)
      sql.push(
        `INSERT INTO version_settings VALUES (${q(kind)},${q(version)},${q(JSON.stringify(defaults))}) ON CONFLICT DO NOTHING;`,
      );
    let entries = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    for (const entry of entries) {
      if (
        entry.isDirectory() &&
        ids.has(entry.name) &&
        !records.has(`${version}/${entry.name}`)
      )
        records.set(`${version}/${entry.name}`, {
          version,
          id: entry.name,
          published: null,
          dir: path.join(dir, entry.name),
        });
    }
  }
  for (const { version, id, published, dir } of records.values()) {
    const internal = path.join(dir, "_internal");
    const volume = await settingsFile(dir, [
      "_internal/2-passage-audio-settings.json",
      "internal/reading-audio.json",
      "reading-audio.json",
    ]);
    const offsets = await settingsFile(dir, [
      "_internal/2-passage-audio-offsets.json",
      "_internal/2-offsets.json",
      "internal/offsets.json",
      "offsets.json",
    ]);
    const verses = await settingsFile(dir, [
      "_internal/2-verse-text-offsets.json",
      "_internal/2-verse-offsets.json",
      "internal/verse-offsets.json",
      "verse-offsets.json",
    ]);
    const metadata =
      (await optional(path.join(internal, "0-metadata.txt"))) ??
      (await optional(path.join(dir, "metadata.txt"))) ??
      "";
    const background = /Vídeos: 0-intro\.mp4, ([^\n]+?) \(boomerang/.exec(
      metadata,
    )?.[1];
    const audioMode =
      /Audio de intro y outro: (voice|mix|video)/.exec(metadata)?.[1] ??
      "voice";
    const settings = {
      volumeMultiplier: volume?.volumeMultiplier ?? 1,
      clipAudioMode: audioMode,
      reuseVoices: true,
      passageOffsets: offsets ?? { startSeconds: 0, endSeconds: 0 },
      verseOffsets: (verses?.verses ?? []).map((v) => ({
        reference: v.reference,
        startOffsetSeconds: v.startOffsetSeconds,
        endOffsetSeconds: v.endOffsetSeconds,
      })),
      ...(background ? { background } : {}),
    };
    const filename = kind === "short" ? "short.mp4" : "episode.mp4";
    const video = path.join(dir, filename);
    const exists = await fs.access(video).then(
      () => true,
      () => false,
    );
    const descriptions = {};
    for (const name of [
      "youtube.txt",
      "instagram.txt",
      "tiktok.txt",
      "x.txt",
      "facebook.txt",
    ]) {
      const text = await optional(path.join(dir, name));
      if (text) descriptions[name] = text;
    }
    const projectId = randomUUID();
    const result = {
      output: dir,
      video,
      thumbnail: path.join(dir, "thumbnail.jpg"),
      descriptions,
      legacyMetadata: metadata,
      imported: true,
    };
    sql.push(
      `INSERT INTO projects(id,catalog_id,version_id,status,used_at,published_at,settings,result,updated_at) VALUES (${[projectId, `${kind}:${id}`, version, exists ? "ready" : "draft", published, null, JSON.stringify(settings), JSON.stringify(result), published ?? new Date().toISOString()].map(q).join(",")}) ON CONFLICT(catalog_id,version_id) DO UPDATE SET status=excluded.status,used_at=excluded.used_at,settings=excluded.settings,result=excluded.result,updated_at=excluded.updated_at WHERE projects.result IS NULL AND projects.status='draft' AND projects.settings='{}' AND projects.published_at IS NULL;`,
    );
    media.push({
      projectId,
      kind,
      version,
      catalogId: `${kind}:${id}`,
      output: dir,
      video: exists ? video : null,
      thumbnail: path.join(dir, "thumbnail.jpg"),
      intro: path.join(internal, "1-intro.wav"),
      outro: path.join(internal, "3-outro.wav"),
    });
  }
}
const out = path.resolve(
  process.argv[2] ?? path.join(root, "apps/dashboard/imports/cli.sql"),
);
await fs.mkdir(path.dirname(out), { recursive: true });
await fs.writeFile(out, sql.join("\n") + "\n", { mode: 0o600 });
await fs.writeFile(
  out.replace(/\.sql$/, ".media.json"),
  JSON.stringify(media, null, 2) + "\n",
  { mode: 0o600 },
);
console.log(
  `Prepared ${media.length} projects. SQL: ${out}. No source files were modified. Apply SQL to local or remote D1, then run the media import with the same database environment.`,
);
