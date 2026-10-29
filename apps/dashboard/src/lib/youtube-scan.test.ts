import { test } from "node:test";
import assert from "node:assert/strict";
import { websiteDatabase } from "./test-support/website-database";
import { scanYouTube } from "./youtube-scan";
import {
  parseCatalog,
  parseWatchDate,
  relativePublicationRange,
} from "./youtube-html";
import { saveSocialSettings, emptySocialSettings } from "./social-settings";
const date = Date.parse("2026-10-28T12:00:00Z");
const renderer = (id: string, title: string, relative = "2 hours ago") => ({
  videoRenderer: {
    videoId: id,
    title: { runs: [{ text: title }] },
    publishedTimeText: { simpleText: relative },
  },
});
const next = (token: string) => ({
  continuationItemRenderer: {
    continuationEndpoint: { continuationCommand: { token } },
  },
});
const html = (items: unknown[]) =>
  `<script>ytcfg.set(${JSON.stringify({ INNERTUBE_CONTEXT: { client: { clientName: "WEB", clientVersion: "test-version" } } })});var ytInitialData = ${JSON.stringify({ contents: { twoColumnBrowseResultsRenderer: { tabs: [{ tabRenderer: { selected: true, content: { richGridRenderer: { contents: items } } } }] } } })};</script>`;
async function setup() {
  const result = websiteDatabase();
  const { sqlite, db } = result;
  const accounts = emptySocialSettings();
  accounts.es.youtube = "veobible-es";
  await saveSocialSettings(db, accounts);
  sqlite.exec(
    `INSERT INTO bible_versions(locale,code,label) VALUES('es','rv1909','RV1909');INSERT INTO site_settings(key,value) VALUES('website_sources','[{"locale":"es","version":"rv1909","since":"2026-01-01","enabled":true}]')`,
  );
  for (const kind of ["short", "long", "book"])
    sqlite.prepare("INSERT INTO site_settings(key,value) VALUES(?,?)").run(
      `publication_templates:${kind}`,
      JSON.stringify({
        es: { youtube: "# Título\n{reference}" },
        en: { youtube: "# Title\n{reference}" },
        pt: { youtube: "# Título\n{reference}" },
      }),
    );
  const project = (title: string, kind = "long", published = 1) => {
    const r = sqlite
      .prepare(
        "INSERT INTO video_projects(kind,bible_version_id,slug,title,passage,published) VALUES(?,1,?,?,?,?)",
      )
      .run(kind, `p-${crypto.randomUUID()}`, title, "{}", published);
    return Number(r.lastInsertRowid);
  };
  return { ...result, project };
}
function fake(
  responses: (Response | ((url: string, init?: RequestInit) => Response))[],
) {
  let now = date;
  const requests: { url: string; at: number; init?: RequestInit }[] = [];
  const waits: number[] = [];
  return {
    requests,
    waits,
    runtime: {
      now: () => now,
      sleep: async (ms: number) => {
        waits.push(ms);
        now += ms;
      },
      fetch: (async (input: any, init?: RequestInit) => {
        requests.push({ url: String(input), at: now, init });
        const response = responses.shift();
        if (!response) throw new Error("Unexpected YouTube request");
        return typeof response === "function"
          ? response(String(input), init)
          : response;
      }) as typeof fetch,
    },
  };
}
test("cache-first detection avoids YouTube entirely when nothing is pending or cached matches suffice", async () => {
  const { db, sqlite, project, queries } = await setup();
  const f = fake([]);
  project("Not published", "long", 0);
  assert.equal(
    (await scanYouTube(db, "@veobible-es", crypto.randomUUID(), f.runtime))
      .pending,
    0,
  );
  assert.ok(!queries.some((q) => q.includes("FROM social_video_cache")));
  const id = project("Already cached");
  sqlite
    .prepare(
      "INSERT INTO social_video_cache(platform,video_id,account,title,published_at) VALUES('youtube',?,?,?,?)",
    )
    .run("abcdefghijk", "@veobible-es", "Already cached", "2026-10-27");
  assert.equal(
    (await scanYouTube(db, "@veobible-es", crypto.randomUUID(), f.runtime))
      .projects,
    1,
  );
  assert.equal(
    JSON.parse(
      sqlite
        .prepare("SELECT social_video_ids FROM video_projects WHERE id=?")
        .get(id)!.social_video_ids as string,
    ).youtube,
    "abcdefghijk",
  );
  assert.equal(f.requests.length, 0);
  assert.equal(f.waits.length, 0);
});
test("newest HTML page is cached in full, stops once found, and incidental videos avoid future requests", async () => {
  const { db, project } = await setup();
  project("Target");
  const f = fake([
    new Response(
      html([
        renderer("abcdefghijk", "Target"),
        renderer("12345678901", "Incidental"),
        next("older-page"),
      ]),
    ),
  ]);
  const result = await scanYouTube(
    db,
    "@veobible-es",
    crypto.randomUUID(),
    f.runtime,
  );
  assert.equal(result.projects, 1);
  assert.equal(result.more, false);
  assert.equal(result.imported, 2);
  assert.match(f.requests[0].url, /\/videos\?.*sort=dd/);
  assert.deepEqual(f.waits, [5000]);
  project("Incidental");
  const cached = await scanYouTube(
    db,
    "@veobible-es",
    crypto.randomUUID(),
    f.runtime,
  );
  assert.equal(cached.projects, 1);
  assert.equal(f.requests.length, 1);
});
test("continuations walk older catalog pages only while pending and pause before each request", async () => {
  const { db, project } = await setup();
  project("Older target");
  const f = fake([
    new Response(html([renderer("12345678901", "Other"), next("older")])),
    Response.json({
      onResponseReceivedActions: [
        {
          appendContinuationItemsAction: {
            continuationItems: [renderer("abcdefghijk", "Older target")],
          },
        },
      ],
    }),
  ]);
  const run = crypto.randomUUID();
  assert.equal(
    (await scanYouTube(db, "@veobible-es", run, f.runtime)).more,
    true,
  );
  assert.equal(
    (await scanYouTube(db, "@veobible-es", run, f.runtime)).projects,
    1,
  );
  assert.equal(f.requests[1].init?.method, "POST");
  assert.equal(
    JSON.parse(f.requests[1].init?.body as string).continuation,
    "older",
  );
  assert.deepEqual(f.waits, [5000, 5000]);
  assert.equal(f.requests.length, 2);
});
test("Shorts use their own HTML tab and date lookups are restricted to matching candidates", async () => {
  const { db, project, sqlite } = await setup();
  project("Short target", "short");
  const short = (id: string, title: string) => ({
    shortsLockupViewModel: {
      onTap: { innertubeCommand: { reelWatchEndpoint: { videoId: id } } },
      overlayMetadata: { primaryText: { content: title } },
    },
  });
  const f = fake([
    new Response(
      html([
        short("abcdefghijk", "Short target"),
        short("12345678901", "Unrelated short"),
      ]),
    ),
    new Response(`<meta itemprop="datePublished" content="2026-10-27">`),
  ]);
  const run = crypto.randomUUID();
  assert.equal(
    (await scanYouTube(db, "@veobible-es", run, f.runtime)).more,
    true,
  );
  const found = await scanYouTube(db, "@veobible-es", run, f.runtime);
  assert.equal(found.projects, 1);
  assert.match(f.requests[0].url, /\/shorts\?/);
  assert.match(f.requests[1].url, /watch\?v=abcdefghijk/);
  assert.equal(f.requests.length, 2);
  assert.equal(
    sqlite
      .prepare(
        "SELECT published_at FROM social_video_cache WHERE platform='youtube' AND video_id='12345678901'",
      )
      .get()?.published_at,
    "",
  );
});
test("concurrent requests share a persistent lock, and YouTube rate limits trigger a cooldown", async () => {
  const { db, project } = await setup();
  project("Missing");
  let resume!: () => void;
  let entered!: () => void;
  const started = new Promise<void>((resolve) => (entered = resolve));
  const blocked = new Promise<void>((resolve) => (resume = resolve));
  let fetches = 0;
  const runtime = {
    now: () => date,
    sleep: async () => {
      entered();
      await blocked;
    },
    fetch: (async () => {
      fetches++;
      return new Response("", { status: 429 });
    }) as typeof fetch,
  };
  const first = scanYouTube(db, "@veobible-es", crypto.randomUUID(), runtime);
  await started;
  const second = await scanYouTube(db, "@veobible-es", crypto.randomUUID(), {
    ...runtime,
    sleep: async () => {
      throw new Error("Concurrent request waited for YouTube");
    },
  });
  assert.equal(second.state, "waiting");
  assert.equal(fetches, 0);
  resume();
  assert.equal((await first).state, "paused");
  const retry = await scanYouTube(
    db,
    "@veobible-es",
    crypto.randomUUID(),
    runtime,
  );
  assert.equal(retry.note, "blocked");
  assert.equal(fetches, 1);
});
test("negative cache prevents immediate repeated requests for the same unresolved projects", async () => {
  const { db, project } = await setup();
  project("Missing");
  const f = fake([new Response(html([renderer("12345678901", "Other")]))]);
  const run = crypto.randomUUID();
  await scanYouTube(db, "@veobible-es", run, f.runtime);
  assert.equal(
    (await scanYouTube(db, "@veobible-es", run, f.runtime)).note,
    "not-found",
  );
  assert.equal(
    (await scanYouTube(db, "@veobible-es", crypto.randomUUID(), f.runtime))
      .note,
    "not-found",
  );
  assert.equal(f.requests.length, 1);
});
test("parser supports legacy videos, current lockups and short renderers without losing escaped titles", () => {
  const input = html([
    renderer("abcdefghijk", 'A "quoted" } title'),
    {
      lockupViewModel: {
        contentId: "12345678901",
        metadata: {
          lockupMetadataViewModel: {
            title: { content: "Modern" },
            metadata: {
              contentMetadataViewModel: {
                metadataRows: [
                  { metadataParts: [{ text: { content: "3 days ago" } }] },
                ],
              },
            },
          },
        },
      },
    },
  ]);
  const result = parseCatalog(input, "@veobible-es", "videos", date);
  assert.equal(result.videos.length, 2);
  assert.equal(result.videos[0].title, 'A "quoted" } title');
  assert.ok(result.videos[1].metadata?.publishedRange);
  assert.ok(relativePublicationRange("2d ago", date));
  assert.equal(
    parseWatchDate(
      '<script>var ytInitialPlayerResponse={"videoDetails":{"videoId":"abcdefghijk"},"microformat":{"playerMicroformatRenderer":{"publishDate":"2026-08-09"}}};</script>',
      "abcdefghijk",
    ),
    "2026-08-09",
  );
  const range = relativePublicationRange("2 months ago", date)!;
  assert.ok(range.start < "2026-08-10" && range.end > "2026-08-10");
});

test("a cached candidate across its own minimum date needs just one exact-date request, not another catalog request", async () => {
  const { db, sqlite, project } = await setup();
  project("Boundary title");
  sqlite.exec(
    `UPDATE site_settings SET value='[{"locale":"es","version":"rv1909","since":"2026-08-10","enabled":true},{"locale":"es","version":"spabll","since":"2026-01-01","enabled":true}]' WHERE key='website_sources'`,
  );
  sqlite
    .prepare(
      "INSERT INTO social_video_cache(platform,video_id,account,title,published_at,metadata) VALUES('youtube',?,?,?,?,?)",
    )
    .run(
      "abcdefghijk",
      "@veobible-es",
      "Boundary title",
      "",
      JSON.stringify({
        publishedRange: { start: "2026-08-09", end: "2026-08-11" },
      }),
    );
  const f = fake([
    new Response('<meta itemprop="datePublished" content="2026-08-10">'),
  ]);
  const result = await scanYouTube(
    db,
    "@veobible-es",
    crypto.randomUUID(),
    f.runtime,
  );
  assert.equal(result.projects, 1);
  assert.equal(f.requests.length, 1);
  assert.match(f.requests[0].url, /watch\?v=abcdefghijk/);
  assert.equal(
    sqlite.prepare("SELECT published_at FROM social_video_cache").get()
      ?.published_at,
    "2026-08-10",
  );
});
test("ambiguous cached matches never trigger catalog downloads or overwrite a project", async () => {
  const { db, sqlite, project } = await setup();
  project("Same title");
  for (const id of ["abcdefghijk", "12345678901"])
    sqlite
      .prepare(
        "INSERT INTO social_video_cache(platform,video_id,account,title,published_at) VALUES('youtube',?,?,?,?)",
      )
      .run(id, "@veobible-es", "Same title", "2026-10-27");
  const f = fake([]);
  const result = await scanYouTube(
    db,
    "@veobible-es",
    crypto.randomUUID(),
    f.runtime,
  );
  assert.equal(result.ambiguous, 1);
  assert.equal(result.projects, 0);
  assert.equal(result.note, "ambiguous");
  assert.equal(f.requests.length, 0);
});

test("compact publication labels from current HTML retain date ranges without per-video lookups", () => {
  const page = parseCatalog(
    html([
      {
        lockupViewModel: {
          contentId: "abcdefghijk",
          metadata: {
            lockupMetadataViewModel: {
              title: { content: "Current title" },
              metadata: {
                contentMetadataViewModel: {
                  metadataRows: [
                    {
                      metadataParts: [
                        {
                          text: { content: "4.9K" },
                          accessibilityLabel: "4.9 thousand views",
                        },
                        {
                          text: { content: "2d ago" },
                          accessibilityLabel: "2 days ago",
                        },
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
      },
    ]),
    "@veobible-es",
    "videos",
    date,
  );
  assert.deepEqual(
    page.videos[0].metadata?.publishedRange,
    relativePublicationRange("2 days ago", date),
  );
});

test("YouTube date verification does not update another platform with the same video ID", async () => {
  const { db, sqlite, project } = await setup();
  project("Target");
  sqlite
    .prepare(
      "INSERT INTO social_video_cache(platform,video_id,account,title,published_at) VALUES('youtube','abcdefghijk','@veobible-es','Target','')",
    )
    .run();
  sqlite
    .prepare(
      "INSERT INTO social_video_cache(platform,video_id,account,title,published_at,metadata) VALUES('instagram','abcdefghijk','@veobible-es','Target','','{\"private\":\"keep\"}')",
    )
    .run();
  const f = fake([
    new Response('<meta itemprop="datePublished" content="2026-10-27">'),
  ]);
  const result = await scanYouTube(
    db,
    "@veobible-es",
    crypto.randomUUID(),
    f.runtime,
  );
  assert.equal(result.projects, 1);
  const instagram = sqlite
    .prepare(
      "SELECT published_at,metadata FROM social_video_cache WHERE platform='instagram' AND video_id='abcdefghijk'",
    )
    .get()!;
  assert.equal(instagram.published_at, "");
  assert.deepEqual(JSON.parse(instagram.metadata as string), {
    private: "keep",
  });
});

test("YouTube requests use Worker-supported manual redirects and do not follow unexpected destinations", async () => {
  const { db, project } = await setup();
  project("Juan 3:14–19", "short");
  const f = fake([
    (url, init) => {
      assert.match(url, /\/shorts\?/);
      assert.equal(init?.redirect, "manual");
      return new Response(null, {
        status: 302,
        headers: { Location: "https://consent.youtube.com/" },
      });
    },
  ]);
  const result = await scanYouTube(
    db,
    "@veobible-es",
    crypto.randomUUID(),
    f.runtime,
  );
  assert.equal(result.state, "paused");
  assert.equal(result.note, "unreadable");
  assert.equal(f.requests.length, 1);
  assert.deepEqual(f.waits, [5000]);
});

test("mixed projects check recent Shorts and Videos before continuing older pages", async () => {
  const { db, project, sqlite } = await setup();
  sqlite
    .prepare(
      "UPDATE site_settings SET value=? WHERE key='publication_templates:short'",
    )
    .run(
      JSON.stringify({
        es: { youtube: "# Título\n{reference} | Un momento con la Biblia" },
        en: {},
        pt: {},
      }),
    );
  const target = project("Juan 3:14–19", "short");
  project("Pending long video", "long");
  project("Pending short", "short");
  const short = {
    shortsLockupViewModel: {
      onTap: {
        innertubeCommand: { reelWatchEndpoint: { videoId: "abcdefghijk" } },
      },
      overlayMetadata: {
        primaryText: { content: "Juan 3:14-19 | Un momento con la Biblia" },
      },
    },
  };
  const f = fake([
    new Response(html([short, next("older-shorts")])),
    new Response('<meta itemprop="datePublished" content="2026-10-27">'),
    new Response(
      html([renderer("12345678901", "Other long video"), next("older-videos")]),
    ),
    Response.json({
      onResponseReceivedActions: [
        {
          appendContinuationItemsAction: {
            continuationItems: [renderer("22222222222", "Still older")],
          },
        },
      ],
    }),
  ]);
  const run = crypto.randomUUID();
  await scanYouTube(db, "@veobible-es", run, f.runtime);
  const found = await scanYouTube(db, "@veobible-es", run, f.runtime);
  assert.equal(found.projects, 1);
  assert.equal(
    JSON.parse(
      sqlite
        .prepare("SELECT social_video_ids FROM video_projects WHERE id=?")
        .get(target)!.social_video_ids as string,
    ).youtube,
    "abcdefghijk",
  );
  await scanYouTube(db, "@veobible-es", run, f.runtime);
  await scanYouTube(db, "@veobible-es", run, f.runtime);
  assert.match(f.requests[0].url, /\/shorts\?/);
  assert.match(f.requests[1].url, /\/watch\?v=abcdefghijk/);
  assert.match(f.requests[2].url, /\/videos\?/);
  assert.equal(
    JSON.parse(f.requests[3].init?.body as string).continuation,
    "older-shorts",
  );
  assert(f.requests.every((r) => r.init?.redirect === "manual"));
  assert.deepEqual(f.waits, [5000, 5000, 5000, 5000]);
});

test("missing title templates pause detection without any YouTube request", async () => {
  const { db, sqlite, project } = await setup();
  project("Juan 3:14–19", "short");
  sqlite
    .prepare(
      "DELETE FROM site_settings WHERE key='publication_templates:short'",
    )
    .run();
  const f = fake([]);
  const result = await scanYouTube(
    db,
    "@veobible-es",
    crypto.randomUUID(),
    f.runtime,
  );
  assert.equal(result.state, "paused");
  assert.equal(result.note, "templates");
  assert.equal(f.requests.length, 0);
  assert.equal(result.pending, 1);
});

test("a title template change invalidates negative search caching while reusing downloaded videos", async () => {
  const { db, sqlite, project } = await setup();
  project("Target", "short");
  const f = fake([
    new Response(html([renderer("abcdefghijk", "Hoy: Target"), next("older")])),
  ]);
  const run = crypto.randomUUID();
  assert.equal(
    (await scanYouTube(db, "@veobible-es", run, f.runtime)).imported,
    1,
  );
  sqlite
    .prepare(
      "UPDATE site_settings SET value=? WHERE key='publication_templates:short'",
    )
    .run(
      JSON.stringify({
        es: { youtube: "# Título\nHoy: {reference}" },
        en: {},
        pt: {},
      }),
    );
  const result = await scanYouTube(
    db,
    "@veobible-es",
    crypto.randomUUID(),
    f.runtime,
  );
  assert.equal(result.projects, 1);
  assert.equal(f.requests.length, 1);
});
