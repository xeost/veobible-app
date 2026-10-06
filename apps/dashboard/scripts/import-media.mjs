// Explicit one-time migration of CLI media. D1 is authoritative for project IDs.
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { z } from "zod";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const dash = path.join(root, "apps/dashboard");
const manifest = JSON.parse(
  await fs.readFile(
    process.argv.slice(2).find((arg) => !arg.startsWith("--")) ??
      path.join(dash, "imports/cli.media.json"),
    "utf8",
  ),
);
const mediaRoot = path.resolve(
  root,
  "tools/video-generator-api",
  process.env.VIDEO_MEDIA_DIR ?? "media",
);
const remote = process.argv.includes("--remote");
// Query actual IDs so a repeated idempotent SQL import does not map files to unused UUIDs.
const output = execFileSync(
  path.join(dash, "node_modules/.bin/wrangler"),
  [
    "d1",
    "execute",
    "DB",
    remote ? "--remote" : "--local",
    ...(remote ? ["--env", "production"] : []),
    "--command",
    "SELECT id,catalog_id,version_id FROM projects",
    "--json",
  ],
  { cwd: dash, encoding: "utf8" },
);
const data = JSON.parse(output);
const projects = data.flatMap((r) => r.results);
for (const entry of manifest) {
  const project = projects.find(
    (p) => p.catalog_id === entry.catalogId && p.version_id === entry.version,
  );
  if (!project)
    throw new Error(`Apply the SQL first: ${entry.catalogId}/${entry.version}`);
  z.string().uuid().parse(project.id);
  const kind = z.enum(["short", "long"]).parse(entry.kind);
  for (const [asset, filename] of [
    ["video", "video.mp4"],
    ["thumbnail", "thumbnail.jpg"],
    ["intro", "intro.wav"],
    ["outro", "outro.wav"],
  ]) {
    if (!entry[asset]) continue;
    const destination = path.join(
      mediaRoot,
      asset === "intro" || asset === "outro" ? "sources" : "renders",
      kind,
      project.id,
      filename,
    );
    try {
      await fs.access(entry[asset]);
    } catch {
      continue;
    }
    await fs.mkdir(path.dirname(destination), { recursive: true });
    // Copy-on-write clone where supported; no original output is renamed or deleted.
    try {
      await fs.copyFile(entry[asset], destination, 1 | 2);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
}
console.log(
  `Imported media for ${manifest.length} projects; original CLI files preserved.`,
);
