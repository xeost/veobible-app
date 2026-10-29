import {
  pageVideoProjectPages,
  saveVideoProjectPage,
} from "./pages-from-video-projects";
import { z } from "zod";
import { bindings } from "./env";
import { websiteSources, websiteState } from "./website";
import { scanYouTube } from "./youtube-scan";
import { catalog } from "../../../../packages/website/content";
const channel = z.string().regex(/^(@[\p{L}\p{N}_.-]{1,100}|UC[\w-]{22})$/u);
const source = z.object({
  locale: z.enum(["es", "en", "pt"]),
  version: z.string().regex(/^[a-z0-9-]+$/),
  since: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((s) => !Number.isNaN(Date.parse(s))),
  enabled: z.boolean(),
});
export async function websiteApi(
  req: Request,
  db: D1Database,
  _actor: string,
  json: (data: unknown, status?: number) => Response,
) {
  const path = new URL(req.url).pathname.slice("/api/website".length);
  if (req.method === "GET" && path === "/pages")
    return json(await pageVideoProjectPages(db, new URL(req.url).searchParams));
  if (req.method === "GET" && path === "") {
    const state = await websiteState(db);
    return json({
      sources: state.sources,
      catalog: state.catalog,
      siteUrl: bindings().SITE_DEV_URL ?? null,
    });
  }
  if (req.method !== "POST") return json({ error: "Route not found" }, 404);
  const input = await req.json();
  if (path === "/sources") {
    const rules = z.array(source).max(100).parse(input);
    const configured = await websiteSources(db);
    const sources = rules.map((s) => ({
      ...s,
      channel:
        configured.find((c) => c.locale === s.locale && c.version === s.version)
          ?.channel ?? "",
    }));
    if (
      sources.some(
        (s) => !Object.hasOwn(catalog, `${s.locale}/${s.version}`),
      ) ||
      new Set(sources.map((s) => `${s.locale}/${s.version}`)).size !==
        sources.length
    )
      return json({ error: "Review website sources." }, 400);
    await db
      .prepare(
        "INSERT INTO site_settings(key,value) VALUES('website_sources',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      )
      .bind(JSON.stringify(rules))
      .run();
  } else if (path === "/pages") {
    if (!(await saveVideoProjectPage(db, input)))
      return json({ error: "Video not found" }, 404);
  } else if (path === "/import") {
    const p = z
      .object({ channel, run: z.string().uuid() })
      .strict()
      .parse(input);
    const sources = await websiteSources(db);
    if (!sources.some((s) => s.enabled && s.channel === p.channel))
      return json({ error: "Review website sources." }, 400);
    return json(await scanYouTube(db, p.channel, p.run));
  } else return json({ error: "Route not found" }, 404);
  return json({ ok: true });
}
