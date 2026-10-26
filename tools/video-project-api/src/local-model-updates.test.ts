import { test } from "node:test";
import assert from "node:assert/strict";
import { checkLocalModelUpdates } from "./local-model-updates.js";
import {
  localModelSchema,
  localModelUpdateSchema,
} from "./local-models-contract.js";
const oldSha = "a".repeat(40),
  newSha = "b".repeat(40);
const file = (name: string, digest = "1", size = 100) => ({
  rfilename: name,
  blobId: digest.repeat(40),
  size,
  ...(name.endsWith(".pt") || name.endsWith(".safetensors")
    ? { lfs: { sha256: digest.repeat(64), size } }
    : {}),
});
const voiceFiles = () => [
  file("ve.pt"),
  file("s3gen.pt", "2", 500),
  file("t3_mtl23ls_v2.safetensors", "3", 1000),
  file("grapheme_mtl_merged_expanded_v1.json"),
];
const voice = (overrides = {}) =>
  localModelSchema.parse({
    id: "local-model-1",
    name: "Chatterbox Multilingual",
    role: "voice",
    uses: [{ kind: "short", languages: ["es", "en", "pt"] }],
    repository: "ResembleAI/chatterbox",
    revision: oldSha,
    status: "downloaded",
    variant: "chatterbox-v2",
    software: { name: "chatterbox-tts", version: "0.1.7" },
    ...overrides,
  });
const qwen = (overrides = {}) =>
  voice({
    name: "Qwen3-ASR-0.6B-8bit",
    role: "recognition",
    repository: "mlx-community/Qwen3-ASR-0.6B-8bit",
    variant: "qwen3-asr-0.6b-8bit",
    software: { name: "mlx-audio", version: "0.3.1" },
    ...overrides,
  });
const qwenFiles = () => [
  file("config.json"),
  file("model.safetensors", "2", 1000),
  file("tokenizer.json"),
];
const config = () => ({
  model_type: "qwen3_asr",
  quantization: { bits: 8 },
  thinker_config: {
    model_type: "qwen3_asr",
    text_config: { hidden_size: 1024 },
  },
  transformers_version: "old",
});
function source(
  options: {
    before?: any[];
    after?: any[];
    latestSha?: string;
    beforeConfig?: unknown;
    afterConfig?: unknown;
    list?: string[];
    candidate?: any[];
    failOld?: boolean;
    failList?: boolean;
  } = {},
) {
  const requests: string[] = [];
  const network = (async (url: string | URL | Request, init?: RequestInit) => {
    const request = new URL(String(url));
    assert.equal(request.origin, "https://huggingface.co");
    assert.equal(init?.method ?? "GET", "GET");
    assert.equal(new Headers(init?.headers).has("Authorization"), false);
    assert.equal(new Headers(init?.headers).has("Cookie"), false);
    assert.ok(init?.signal);
    assert.ok(
      !/\.(?:pt|safetensors)$/.test(request.pathname),
      "checks must never request model weights",
    );
    requests.push(request.pathname + request.search);
    if (request.pathname === "/api/models") {
      if (options.failList) return new Response("Unavailable", { status: 503 });
      return Response.json((options.list ?? []).map((id) => ({ id })));
    }
    if (request.pathname.includes("/resolve/"))
      return Response.json(
        request.pathname.includes(oldSha)
          ? (options.beforeConfig ?? config())
          : (options.afterConfig ?? config()),
      );
    if (request.pathname.includes(`/revision/${oldSha}`)) {
      if (options.failOld) return new Response("Missing", { status: 404 });
      return Response.json({
        sha: oldSha,
        siblings: options.before ?? voiceFiles(),
      });
    }
    if (
      request.pathname.includes("Qwen3.5") ||
      request.pathname.includes("Chatterbox-Multilingual-V4")
    )
      return Response.json({
        sha: newSha,
        siblings: options.candidate ?? qwenFiles(),
      });
    return Response.json({
      sha: options.latestSha ?? newSha,
      siblings: options.after ?? voiceFiles(),
    });
  }) as typeof fetch;
  return { network, requests };
}

test("a changed repo revision with only documentation or unused voice files does not recommend an update", async () => {
  const { network, requests } = source({
    after: [
      ...voiceFiles(),
      file("README.md", "4"),
      file("t3_cfg.safetensors", "5"),
    ],
  });
  const result = await checkLocalModelUpdates(voice(), { fetch: network });
  assert.equal(result.status, "up_to_date");
  assert.equal(result.reason, "same_files");
  assert.equal(result.changedFiles, 0);
  assert.equal(result.compatibility, "expected_fit");
  assert.ok(requests.length > 0);
  assert.ok(localModelUpdateSchema.safeParse(result).success);
});

test("changed inference weights of the same size recommend testing an update, with no weight downloads", async () => {
  const after = voiceFiles();
  after[2] = file("t3_mtl23ls_v2.safetensors", "6", 1000);
  const { network } = source({ after });
  const result = await checkLocalModelUpdates(voice(), { fetch: network });
  assert.equal(result.status, "update_available");
  assert.equal(result.reason, "used_files_changed");
  assert.equal(result.changedFiles, 1);
  assert.equal(result.compatibility, "expected_fit");
  assert.equal(result.latestRevision, newSha);
});

test("a new multilingual variant is detected even if the cached repo revision is current; the bundled worker already supports V3", async () => {
  const { network } = source({
    latestSha: oldSha,
    after: [...voiceFiles(), file("t3_mtl23ls_v3.safetensors", "7", 1000)],
  });
  const result = await checkLocalModelUpdates(voice(), { fetch: network });
  assert.equal(result.status, "new_variant");
  assert.equal(result.reason, "same_revision");
  assert.equal(result.variants[0].name, "Chatterbox Multilingual V3");
  assert.equal(result.variants[0].requiresIntegration, false);
  assert.equal(result.variants[0].compatibility, "expected_fit");
  const shared = await checkLocalModelUpdates(
    voice({ variant: "chatterbox-shared" }),
    { fetch: network },
  );
  assert.equal(
    shared.variants.length,
    0,
    "Latam's shared components must not suggest replacing its specialized voice with V3",
  );
});

test("larger weights, unknown sizes and unverified software never receive an automatic update recommendation", async () => {
  for (const size of [1200, 5 * 1024 ** 3]) {
    const after = voiceFiles();
    after[2] = file("t3_mtl23ls_v2.safetensors", "6", size);
    const result = await checkLocalModelUpdates(voice(), {
      fetch: source({ after }).network,
    });
    assert.equal(result.status, "review_required");
    assert.equal(result.reason, "size_limit");
    assert.equal(result.compatibility, "review_required");
  }
  const unknown = voiceFiles().map((item) => ({
    rfilename: item.rfilename,
    blobId: item.blobId,
  }));
  const unknownResult = await checkLocalModelUpdates(voice(), {
    fetch: source({ after: unknown }).network,
  });
  assert.notEqual(unknownResult.compatibility, "expected_fit");
  const after = voiceFiles();
  after[2] = file("t3_mtl23ls_v2.safetensors", "6", 1000);
  const result = await checkLocalModelUpdates(
    voice({ software: { name: "chatterbox-tts", version: null } }),
    { fetch: source({ after }).network },
  );
  assert.equal(result.status, "review_required");
  assert.equal(result.reason, "unknown_software");
});

test("MLX updates require the same architecture and quantization configuration for this Mac", async () => {
  const after = qwenFiles();
  after[1] = file("model.safetensors", "6", 1000);
  let result = await checkLocalModelUpdates(qwen(), {
    fetch: source({
      before: qwenFiles(),
      after,
      afterConfig: { ...config(), transformers_version: "new" },
    }).network,
  });
  assert.equal(result.status, "update_available");
  assert.equal(result.compatibility, "expected_fit");
  result = await checkLocalModelUpdates(qwen(), {
    fetch: source({
      before: qwenFiles(),
      after,
      afterConfig: { ...config(), quantization: { bits: 16 } },
    }).network,
  });
  assert.equal(result.status, "review_required");
  assert.equal(result.reason, "format_changed");
  result = await checkLocalModelUpdates(qwen(), {
    fetch: source({
      before: qwenFiles(),
      after,
      afterConfig: {
        ...config(),
        thinker_config: { model_type: "new_architecture" },
      },
    }).network,
  });
  assert.equal(result.status, "review_required");
});

test("family discovery excludes larger models, different quantizations, unrelated languages and untrusted publishers", async () => {
  const { network, requests } = source({
    before: qwenFiles(),
    after: qwenFiles(),
    list: [
      "mlx-community/Qwen3.5-ASR-0.6B-8bit",
      "mlx-community/Qwen4-ASR-7B-8bit",
      "mlx-community/Qwen4-ASR-0.6B-4bit",
      "evil/Qwen9-ASR-0.6B-8bit",
      "mlx-community/Qwen2-ASR-0.6B-8bit",
      "mlx-community/Qwen4-ForcedAligner-0.6B-8bit",
    ],
  });
  const result = await checkLocalModelUpdates(qwen(), { fetch: network });
  assert.equal(result.status, "new_variant");
  assert.deepEqual(
    result.variants.map((item) => item.repository),
    ["mlx-community/Qwen3.5-ASR-0.6B-8bit"],
  );
  assert.equal(result.variants[0].compatibility, "review_required");
  assert.equal(result.variants[0].requiresIntegration, true);
  assert.ok(
    !requests.some(
      (url) =>
        url.includes("evil") || url.includes("7B") || url.includes("4bit"),
    ),
  );
  const voiceResult = await checkLocalModelUpdates(voice(), {
    fetch: source({
      list: [
        "ResembleAI/Chatterbox-Multilingual-zh-cmn",
        "ResembleAI/Chatterbox-Turbo",
        "unknown/Chatterbox-Multilingual-V4",
      ],
    }).network,
  });
  assert.equal(voiceResult.variants.length, 0);
});

test("custom sources make no remote requests, and missing baselines or missing file hashes cannot be reported as current", async () => {
  let count = 0;
  const result = await checkLocalModelUpdates(
    voice({ repository: null, variant: "custom", status: "local" }),
    {
      fetch: (async () => {
        count++;
        throw new Error("unexpected request");
      }) as typeof fetch,
    },
  );
  assert.equal(result.status, "unsupported");
  assert.equal(count, 0);
  const unknown = await checkLocalModelUpdates(voice(), {
    fetch: source({ failOld: true }).network,
  });
  assert.equal(unknown.status, "review_required");
  assert.equal(unknown.reason, "unknown_baseline");
  const noHashes = voiceFiles().map(({ rfilename, size }) => ({
    rfilename,
    size,
  }));
  assert.equal(
    (
      await checkLocalModelUpdates(voice(), {
        fetch: source({ before: noHashes, after: noHashes }).network,
      })
    ).status,
    "review_required",
  );
  assert.equal(
    (
      await checkLocalModelUpdates(
        voice({ status: "not_downloaded", revision: null }),
        { fetch: source().network },
      )
    ).status,
    "not_downloaded",
  );
});

test("publisher failures and rate limiting allow retry without erasing a successful model comparison", async () => {
  const rateLimited = await checkLocalModelUpdates(voice(), {
    fetch: (async () =>
      new Response("Private diagnostic", { status: 429 })) as typeof fetch,
  });
  assert.equal(rateLimited.status, "unavailable");
  assert.equal(rateLimited.reason, "rate_limited");
  assert.ok(!JSON.stringify(rateLimited).includes("Private diagnostic"));
  const partial = await checkLocalModelUpdates(voice(), {
    fetch: source({ failList: true }).network,
  });
  assert.equal(partial.status, "up_to_date");
  assert.equal(partial.discovery, "unavailable");
  const tooLarge = await checkLocalModelUpdates(voice(), {
    fetch: (async () =>
      new Response(" ".repeat(2 * 1024 * 1024 + 1))) as typeof fetch,
  });
  assert.equal(tooLarge.status, "unavailable");
});

test("V3 checks its own weights and never offers V3 as a new variant", async () => {
  const files = [...voiceFiles(), file("t3_mtl23ls_v3.safetensors", "4", 1000)];
  const result = await checkLocalModelUpdates(
    voice({ variant: "chatterbox-v3", revision: newSha }),
    {
      fetch: source({ before: files, after: files, latestSha: newSha }).network,
    },
  );
  assert.equal(result.status, "up_to_date");
  assert.deepEqual(result.variants, []);
});

test("V3 update comparisons ignore V2-only changes and detect changed V3 inference weights", async () => {
  const before = [
    ...voiceFiles(),
    file("t3_mtl23ls_v3.safetensors", "4", 1000),
  ];
  const after = before.map((entry) =>
    entry.rfilename === "t3_mtl23ls_v2.safetensors"
      ? file(entry.rfilename, "5", 1000)
      : entry,
  );
  const model = voice({ variant: "chatterbox-v3" });
  const unchanged = await checkLocalModelUpdates(model, {
    fetch: source({ before, after }).network,
  });
  assert.equal(unchanged.status, "up_to_date");
  after[after.length - 1] = file("t3_mtl23ls_v3.safetensors", "6", 1000);
  const changed = await checkLocalModelUpdates(model, {
    fetch: source({ before, after }).network,
  });
  assert.equal(changed.status, "update_available");
  assert.equal(changed.changedFiles, 1);
  assert.equal(changed.compatibility, "expected_fit");
});

test("original English Chatterbox checks English files independently from multilingual weights", async () => {
  const before = [
    file("ve.safetensors"),
    file("t3_cfg.safetensors", "2", 1000),
    file("s3gen.safetensors", "3", 500),
    file("tokenizer.json"),
    file("conds.pt"),
  ];
  const model = voice({
    name: "Chatterbox",
    variant: "chatterbox-original",
    uses: [],
  });
  const after = [...before, file("t3_mtl23ls_v3.safetensors", "5", 1000)];
  const same = await checkLocalModelUpdates(model, {
    fetch: source({ before, after }).network,
  });
  assert.equal(same.status, "up_to_date");
  assert.equal(same.changedFiles, 0);
  after[1] = file("t3_cfg.safetensors", "6", 1000);
  const changed = await checkLocalModelUpdates(model, {
    fetch: source({ before, after }).network,
  });
  assert.equal(changed.status, "update_available");
  assert.equal(changed.changedFiles, 1);
});

test("Brazilian Portuguese checks its own T3 and decoder without counting duplicate decoder formats", async () => {
  const before = [
    file("t3_pt_br.safetensors", "2", 1000),
    file("s3gen_v3.pt", "3", 500),
    file("grapheme_mtl_merged_expanded_v1.json"),
    file("s3gen_v3.safetensors", "4", 500),
  ];
  const model = voice({
    name: "Chatterbox Multilingual pt-BR",
    variant: "chatterbox-pt-br",
    repository: "ResembleAI/Chatterbox-Multilingual-pt-br",
    uses: [],
  });
  const same = await checkLocalModelUpdates(model, {
    fetch: source({ before, after: before }).network,
  });
  assert.equal(same.status, "up_to_date");
  assert.equal(same.downloadBytes, 1500);
  const after = [...before];
  after[1] = file("s3gen_v3.pt", "6", 500);
  const changed = await checkLocalModelUpdates(model, {
    fetch: source({ before, after }).network,
  });
  assert.equal(changed.status, "update_available");
  assert.equal(changed.changedFiles, 1);
});

test("Qwen Base updates compare both model and speech tokenizer metadata without downloading weights", async () => {
  for (const [size, variant] of [
    ["0.6", "qwen3-base-0.6b"],
    ["1.7", "qwen3-base-1.7b"],
  ] as const) {
    const model = voice({
      name: `Qwen3-TTS Base ${size}B`,
      repository: `Qwen/Qwen3-TTS-12Hz-${size}B-Base`,
      variant,
      software: { name: "qwen-tts", version: "0.1.1" },
    });
    const required = [
      "config.json",
      "model.safetensors",
      "tokenizer_config.json",
      "preprocessor_config.json",
      "generation_config.json",
      "vocab.json",
      "merges.txt",
      "speech_tokenizer/config.json",
      "speech_tokenizer/preprocessor_config.json",
      "speech_tokenizer/model.safetensors",
    ];
    const before = required.map((name) => file(name));
    const after = before.map((entry) =>
      entry.rfilename === "model.safetensors"
        ? file(entry.rfilename, "2")
        : entry,
    );
    const configuration = {
      model_type: "qwen3_tts",
      tts_model_type: "base",
      tts_model_size: size === "0.6" ? "0b6" : "1b7",
      hidden_size: 1024,
    };
    const compatible = source({
      before,
      after,
      beforeConfig: configuration,
      afterConfig: configuration,
    });
    const update = await checkLocalModelUpdates(model, {
      fetch: compatible.network,
    });
    assert.equal(update.status, "update_available");
    assert.equal(update.compatibility, "expected_fit");
    assert.ok(
      compatible.requests.some((path) =>
        path.includes("/speech_tokenizer/config.json"),
      ),
    );
    const changed = source({
      before,
      after,
      beforeConfig: configuration,
      afterConfig: { ...configuration, hidden_size: 2048 },
    });
    const review = await checkLocalModelUpdates(model, {
      fetch: changed.network,
    });
    assert.equal(review.status, "review_required");
    assert.equal(review.reason, "format_changed");
  }
});
