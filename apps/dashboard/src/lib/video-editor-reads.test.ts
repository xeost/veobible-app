import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { videoEditorRead } from "./video-editor-reads";
import { defaultBaseVoices } from "./base-voices";

function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`CREATE TABLE bible_versions(id INTEGER,code TEXT,locale TEXT);
    CREATE TABLE video_projects(id INTEGER,kind TEXT,slug TEXT,passage TEXT,settings TEXT,bible_version_id INTEGER);
    CREATE TABLE site_settings(key TEXT PRIMARY KEY,value TEXT,updated_at TEXT DEFAULT 'same-timestamp');
    INSERT INTO bible_versions VALUES(1,'rv1909','es');`);
  const settings = {
    voiceDefaultsVersion: 1,
    baseVoice: "es-1",
    inheritedBaseVoiceRoles: ["intro"],
    verseOffsets: Array.from({ length: 1500 }, (_, i) => ({
      reference: String(i),
      startOffsetSeconds: 0,
      endOffsetSeconds: 1,
    })),
  };
  sqlite
    .prepare("INSERT INTO video_projects VALUES(1,'book','genesis',?,?,1)")
    .run(
      JSON.stringify({
        id: "genesis",
        book: "genesis",
        start: { chapter: 1, verse: 1 },
        end: { chapter: 50, verse: 1 },
      }),
      JSON.stringify(settings),
    );
  const queries: string[] = [];
  const database = {
    prepare(query: string) {
      queries.push(query);
      return {
        bind(...args: any[]) {
          return {
            async first() {
              return sqlite.prepare(query).get(...args) ?? null;
            },
            async all() {
              return { results: sqlite.prepare(query).all(...args) };
            },
          };
        },
      };
    },
  } as unknown as D1Database;
  const read = (
    action: string,
    forward: (path: string) => Promise<Response>,
    sign = async () => ({}),
    kind = "book",
  ) =>
    videoEditorRead(
      new Request(
        `https://dashboard.test/api/videos/1/${action}${action.includes("?") ? "&" : "?"}kind=${kind}`,
      ),
      database,
      1,
      "production",
      forward,
      sign,
    );
  return { sqlite, database, queries, read };
}

test("state and alignment reads stream responses with one small metadata query and no voice configuration", async () => {
  const { sqlite, queries, read } = fixture();
  try {
    for (const action of ["state", "alignment"]) {
      queries.length = 0;
      let destination = "";
      const response = await read(
        `${action}?updates=1&cursor=opaque`,
        async (path) => {
          destination = path;
          const response = new Response('{"unchanged":true,"cursor":"opaque"}');
          response.json = async () => {
            throw new Error("must stream without decoding");
          };
          return response;
        },
        async () => {
          throw new Error("must not sign playback grants");
        },
      );
      assert.equal(
        await response!.text(),
        '{"unchanged":true,"cursor":"opaque"}',
      );
      assert.equal(queries.length, 1);
      assert.ok(!queries[0].includes("settings"));
      const target = new URL(destination, "https://service.test");
      assert.equal(target.searchParams.get("cursor"), "opaque");
      assert.equal(target.searchParams.get("outputEnvironment"), "production");
      assert.equal(target.searchParams.has("voiceModel"), false);
      assert.equal(target.searchParams.has("passageRange"), false);
    }
    const wrongKind = await read(
      "alignment",
      async () => {
        throw new Error("scope mismatch must not reach service");
      },
      undefined,
      "short",
    );
    assert.equal(wrongKind!.status, 404);
  } finally {
    sqlite.close();
  }
});

test("voice reads load only voice selectors and reuse configuration until exact saved values change", async () => {
  const { sqlite, queries, read } = fixture();
  try {
    const requests: URL[] = [];
    const forward = async (path: string) => {
      requests.push(new URL(path, "https://service.test"));
      return Response.json({ voices: {} });
    };
    await read("voices?updates=1", forward);
    assert.equal(requests[0].searchParams.get("baseVoice"), "es-1");
    assert.ok(requests[0].searchParams.get("voiceModel"));
    assert.ok(
      queries.every(
        (query) =>
          !query.includes("p.*") &&
          !query.includes("SELECT value") &&
          !query.includes("verseOffsets"),
      ),
    );
    assert.equal(queries.length, 2);
    const defaults = defaultBaseVoices();
    defaults.es.intro = "es-2";
    sqlite
      .prepare("INSERT INTO site_settings(key,value) VALUES(?,?)")
      .run("base_voice_defaults:book", JSON.stringify(defaults));
    await read("voices?updates=1&cursor=first", forward);
    assert.equal(requests[1].searchParams.get("baseVoice"), "es-2");
    assert.equal(requests[1].searchParams.get("cursor"), "first");
    defaults.es.intro = "es-3";
    sqlite
      .prepare("UPDATE site_settings SET value=? WHERE key=?")
      .run(JSON.stringify(defaults), "base_voice_defaults:book");
    await read("voices?updates=1&cursor=second", forward);
    assert.equal(requests[2].searchParams.get("baseVoice"), "es-3");
    // Cached URLSearchParams must not retain a previous caller's cursor.
    await read("voices", forward);
    assert.equal(requests[3].searchParams.has("cursor"), false);
    sqlite
      .prepare(
        "UPDATE video_projects SET settings=json_set(settings,'$.inheritedBaseVoiceRoles',json('[]'),'$.baseVoice','es-4')",
      )
      .run();
    await read("voices", forward);
    assert.equal(requests[4].searchParams.get("baseVoice"), "es-4");
    assert.ok(queries.filter((q) => q.includes("voice_settings")).length === 5);
  } finally {
    sqlite.close();
  }
});

test("playback renewal signs a grant without querying render state or reading all project settings", async () => {
  const { sqlite, database } = fixture();
  try {
    let signed = false;
    const response = await videoEditorRead(
      new Request("https://dashboard.test/api/videos/1/media-access?kind=book"),
      database,
      1,
      "production",
      async () => {
        throw new Error("renewal must not read render state");
      },
      async (path, query) => {
        signed = true;
        assert.equal(path, "/v1/projects/1/media/");
        assert.equal(query.get("loudnessTarget"), "-14");
        assert.equal(query.get("outputEnvironment"), "production");
        assert.equal(query.has("cursor"), false);
        return { base: "signed", expiresAt: 123 };
      },
    );
    assert.equal(signed, true);
    assert.deepEqual(await response!.json(), {
      mediaAccess: { base: "signed", expiresAt: 123 },
    });
  } finally {
    sqlite.close();
  }
});
