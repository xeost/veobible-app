import { z } from "zod";
import {
  type LocalModels,
  type LocalModelUpdate,
  localModelUpdateSchema,
} from "./local-models-contract.js";

type Model = LocalModels["models"][number];
type Variant = LocalModelUpdate["variants"][number];
const sha = z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/);
const metadataSchema = z.object({
  sha,
  siblings: z
    .array(
      z.object({
        rfilename: z.string().max(300),
        size: z.number().int().nonnegative().optional(),
        blobId: sha.optional(),
        lfs: z
          .object({
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
            size: z.number().int().nonnegative(),
          })
          .nullish(),
      }),
    )
    .max(5000),
});
type Metadata = z.infer<typeof metadataSchema>;
type File = Metadata["siblings"][number];
const GiB = 1024 ** 3;
const commonVoice = [
  "ve.pt",
  "s3gen.pt",
  "grapheme_mtl_merged_expanded_v1.json",
];
const profiles = {
  "cosyvoice3-base-0.5b": {
    repo: "FunAudioLLM/Fun-CosyVoice3-0.5B-2512",
    required: [
      "llm.pt",
      "flow.pt",
      "hift.pt",
      "campplus.onnx",
      "speech_tokenizer_v3.onnx",
      "cosyvoice3.yaml",
      "CosyVoice-BlankEN/config.json",
      "CosyVoice-BlankEN/tokenizer_config.json",
      "CosyVoice-BlankEN/model.safetensors",
      "CosyVoice-BlankEN/vocab.json",
      "CosyVoice-BlankEN/merges.txt",
    ],
    maxBytes: 10 * GiB,
  },
  "cosyvoice3-rl-0.5b": {
    repo: "FunAudioLLM/Fun-CosyVoice3-0.5B-2512",
    required: [
      "llm.rl.pt",
      "flow.pt",
      "hift.pt",
      "campplus.onnx",
      "speech_tokenizer_v3.onnx",
      "cosyvoice3.yaml",
      "CosyVoice-BlankEN/config.json",
      "CosyVoice-BlankEN/tokenizer_config.json",
      "CosyVoice-BlankEN/model.safetensors",
      "CosyVoice-BlankEN/vocab.json",
      "CosyVoice-BlankEN/merges.txt",
    ],
    maxBytes: 10 * GiB,
  },
  "qwen3-base-0.6b": {
    repo: "Qwen/Qwen3-TTS-12Hz-0.6B-Base",
    required: [
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
    ],
    maxBytes: 8 * GiB,
  },
  "qwen3-base-1.7b": {
    repo: "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
    required: [
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
    ],
    maxBytes: 12 * GiB,
  },
  "chatterbox-original": {
    repo: "ResembleAI/chatterbox",
    required: [
      "ve.safetensors",
      "t3_cfg.safetensors",
      "s3gen.safetensors",
      "tokenizer.json",
      "conds.pt",
    ],
    maxBytes: 4 * GiB,
  },
  "chatterbox-pt-br": {
    repo: "ResembleAI/Chatterbox-Multilingual-pt-br",
    required: [
      "t3_pt_br.safetensors",
      "s3gen_v3.pt",
      "grapheme_mtl_merged_expanded_v1.json",
    ],
    maxBytes: 4 * GiB,
  },
  "chatterbox-v3": {
    repo: "ResembleAI/chatterbox",
    required: [...commonVoice, "t3_mtl23ls_v3.safetensors"],
    maxBytes: 4 * GiB,
  },
  "chatterbox-v2": {
    repo: "ResembleAI/chatterbox",
    required: [...commonVoice, "t3_mtl23ls_v2.safetensors"],
    maxBytes: 4 * GiB,
  },
  "chatterbox-shared": {
    repo: "ResembleAI/chatterbox",
    required: commonVoice,
    maxBytes: 4 * GiB,
  },
  "chatterbox-latam": {
    repo: "ResembleAI/Chatterbox-Multilingual-es-mx-latam",
    required: [
      "t3_es_mx_latam.safetensors",
      "grapheme_mtl_merged_expanded_v1.json",
    ],
    maxBytes: 4 * GiB,
  },
  "qwen3-aligner-0.6b-8bit": {
    repo: "mlx-community/Qwen3-ForcedAligner-0.6B-8bit",
    required: ["config.json", "model.safetensors"],
    maxBytes: 2 * GiB,
  },
  "qwen3-asr-0.6b-8bit": {
    repo: "mlx-community/Qwen3-ASR-0.6B-8bit",
    required: ["config.json", "model.safetensors"],
    maxBytes: 2 * GiB,
  },
} as const;
type Profile = (typeof profiles)[keyof typeof profiles];
class SourceError extends Error {
  constructor(public status = 0) {
    super("Model source unavailable");
  }
}
const fileSize = (file: File) => file.lfs?.size ?? file.size;
const fingerprint = (file: File) => file.lfs?.sha256 ?? file.blobId;
const isWeight = (name: string) => /\.(?:pt|safetensors)$/.test(name);
function usedFiles(meta: Metadata, model: Model, profile: Profile) {
  return meta.siblings.filter((file) =>
    model.role === "voice"
      ? (profile.required as readonly string[]).includes(file.rfilename) ||
        file.rfilename === "conds.pt"
      : /(?:^|\/)(?:config\.json|generation_config\.json|preprocessor_config\.json|processor_config\.json|tokenizer(?:_config)?\.json|vocab\.json|merges\.txt|tokenizer\.model|special_tokens_map\.json|added_tokens\.json|.*\.safetensors(?:\.index\.json)?)$/.test(
          file.rfilename,
        ),
  );
}
function weightsSize(files: File[]) {
  const weights = files.filter((file) => isWeight(file.rfilename));
  return weights.length && weights.every((file) => fileSize(file) !== undefined)
    ? weights.reduce((total, file) => total + fileSize(file)!, 0)
    : null;
}
function softwareKnown(model: Model) {
  const version = model.software.version ?? "";
  if (model.software.name === "cosyvoice")
    return version === "git+074ca6dc9e80";
  const match = /^0\.(\d+)\.(\d+)(?:\+[\w.]+)?$/.exec(version);
  return Boolean(
    match &&
    (model.software.name === "chatterbox-tts"
      ? Number(match[1]) === 1 && Number(match[2]) >= 7
      : model.software.name === "qwen-tts"
        ? Number(match[1]) === 1 && Number(match[2]) === 1
        : Number(match[1]) === 3 && Number(match[2]) >= 1),
  );
}
function comparableSize(
  before: number | null,
  after: number | null,
  cap: number,
) {
  return (
    before !== null &&
    before > 0 &&
    after !== null &&
    after > 0 &&
    after <= cap &&
    after <= before * 1.1
  );
}
function canonicalConfig(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalConfig).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(
        ([key]) =>
          !["_name_or_path", "transformers_version", "_commit_hash"].includes(
            key,
          ),
      )
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalConfig(child)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

export async function checkLocalModelUpdates(
  model: Model,
  options: { fetch?: typeof fetch } = {},
): Promise<LocalModelUpdate> {
  const result: LocalModelUpdate = {
    checkedAt: new Date().toISOString(),
    model,
    latestRevision: null,
    status: "unsupported",
    reason: "no_public_source",
    compatibility: "not_assessed",
    downloadBytes: null,
    changedFiles: 0,
    variants: [],
    discovery: "not_applicable",
  };
  const profile = model.variant === "custom" ? null : profiles[model.variant];
  if (
    !profile ||
    model.repository !== profile.repo ||
    ["custom", "local"].includes(model.status)
  )
    return localModelUpdateSchema.parse(result);
  // Public metadata only. Never forward local authentication or download weights.
  const signal = AbortSignal.timeout(18_000);
  const network = options.fetch ?? fetch;
  const readJson = async (pathname: string): Promise<unknown> => {
    const response = await network(`https://huggingface.co${pathname}`, {
      signal,
      headers: { Accept: "application/json", "Cache-Control": "no-cache" },
      cache: "no-store",
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new SourceError(response.status);
    }
    const reader = response.body?.getReader();
    if (!reader) throw new SourceError();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        length += chunk.value.byteLength;
        if (length > 2 * 1024 * 1024) throw new SourceError();
        chunks.push(chunk.value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  };
  const reads = new Map<string, Promise<unknown>>();
  const json = (pathname: string) => {
    if (!reads.has(pathname)) reads.set(pathname, readJson(pathname));
    return reads.get(pathname)!;
  };
  const metadata = async (repository: string, revision: string) =>
    metadataSchema.parse(
      await json(`/api/models/${repository}/revision/${revision}?blobs=true`),
    );
  let latest: Metadata;
  try {
    latest = await metadata(profile.repo, "main");
  } catch (cause) {
    result.status = "unavailable";
    result.reason =
      cause instanceof SourceError && cause.status === 429
        ? "rate_limited"
        : "source_unavailable";
    return localModelUpdateSchema.parse(result);
  }
  result.latestRevision = latest.sha;
  const latestUsed = usedFiles(latest, model, profile);
  const latestBytes = weightsSize(latestUsed);
  result.downloadBytes = latestBytes;
  const hasFiles = profile.required.every((name) =>
    latestUsed.some((file) => file.rfilename === name),
  );
  let baseline: Metadata | null = null;
  try {
    baseline = model.revision
      ? model.revision === latest.sha
        ? latest
        : await metadata(profile.repo, model.revision)
      : null;
    if (baseline && baseline.sha !== model.revision) baseline = null;
  } catch {
    /* An unavailable baseline must never be called up to date. */
  }
  const oldUsed = baseline ? usedFiles(baseline, model, profile) : [];
  const oldBytes = baseline ? weightsSize(oldUsed) : null;
  const withinBudget =
    latestBytes !== null && latestBytes > 0 && latestBytes <= profile.maxBytes;
  let formatMatches = model.role === "voice";
  if (model.variant.startsWith("qwen3-base-") && baseline && hasFiles) {
    try {
      const [before, after, tokenizerBefore, tokenizerAfter] =
        await Promise.all([
          json(`/${profile.repo}/resolve/${baseline.sha}/config.json`),
          json(`/${profile.repo}/resolve/${latest.sha}/config.json`),
          json(
            `/${profile.repo}/resolve/${baseline.sha}/speech_tokenizer/config.json`,
          ),
          json(
            `/${profile.repo}/resolve/${latest.sha}/speech_tokenizer/config.json`,
          ),
        ]);
      const config = z
        .object({
          model_type: z.literal("qwen3_tts"),
          tts_model_type: z.literal("base"),
          tts_model_size: z.literal(
            model.variant === "qwen3-base-0.6b" ? "0b6" : "1b7",
          ),
        })
        .passthrough()
        .safeParse(after);
      formatMatches =
        config.success &&
        canonicalConfig(before) === canonicalConfig(after) &&
        canonicalConfig(tokenizerBefore) === canonicalConfig(tokenizerAfter);
    } catch {
      formatMatches = false;
    }
  }
  if (model.role !== "voice" && baseline && hasFiles) {
    try {
      const [before, after] = await Promise.all([
        json(`/${profile.repo}/resolve/${baseline.sha}/config.json`),
        json(`/${profile.repo}/resolve/${latest.sha}/config.json`),
      ]);
      const config = z
        .object({
          model_type: z.literal("qwen3_asr"),
          quantization: z.object({ bits: z.literal(8) }),
          thinker_config: z.object({
            model_type: z.literal(
              model.role === "alignment" ? "qwen3_forced_aligner" : "qwen3_asr",
            ),
          }),
        })
        .passthrough()
        .safeParse(after);
      formatMatches =
        config.success && canonicalConfig(before) === canonicalConfig(after);
    } catch {
      formatMatches = false;
    }
  }
  const fits =
    hasFiles &&
    formatMatches &&
    softwareKnown(model) &&
    withinBudget &&
    (baseline
      ? comparableSize(oldBytes, latestBytes, profile.maxBytes)
      : false);
  result.compatibility = fits ? "expected_fit" : "review_required";
  if (!hasFiles) {
    result.status = "review_required";
    result.reason = "format_changed";
  } else if (
    model.status === "not_downloaded" ||
    model.status === "incomplete"
  ) {
    result.status = "not_downloaded";
    result.reason = "missing_local";
  } else if (
    !baseline ||
    !oldUsed.length ||
    !profile.required.every((name) =>
      oldUsed.some((file) => file.rfilename === name),
    ) ||
    [...oldUsed, ...latestUsed].some((file) => !fingerprint(file))
  ) {
    result.status = "review_required";
    result.reason = "unknown_baseline";
  } else {
    const previous = new Map(
      oldUsed.map((file) => [file.rfilename, fingerprint(file)]),
    );
    const next = new Map(
      latestUsed.map((file) => [file.rfilename, fingerprint(file)]),
    );
    result.changedFiles = [
      ...new Set([...previous.keys(), ...next.keys()]),
    ].filter((name) => previous.get(name) !== next.get(name)).length;
    if (!result.changedFiles) {
      result.status = "up_to_date";
      result.reason =
        baseline.sha === latest.sha ? "same_revision" : "same_files";
    } else {
      result.status = fits ? "update_available" : "review_required";
      result.reason = !softwareKnown(model)
        ? "unknown_software"
        : !formatMatches
          ? "format_changed"
          : !comparableSize(oldBytes, latestBytes, profile.maxBytes)
            ? "size_limit"
            : "used_files_changed";
    }
  }
  // Approved successor within the same publisher/model family. The existing
  // selected T3 version matters even when main's SHA is unchanged.
  if (model.variant === "chatterbox-v2" || model.variant === "chatterbox-v3") {
    const selectedVersion = model.variant === "chatterbox-v3" ? 3 : 2;
    const current = latest.siblings.find(
      (file) => file.rfilename === `t3_mtl23ls_v${selectedVersion}.safetensors`,
    );
    const newer = latest.siblings
      .filter((file) =>
        Boolean(
          /^t3_mtl23ls_v(\d+)\.safetensors$/.test(file.rfilename) &&
          Number(/_v(\d+)/.exec(file.rfilename)![1]) > selectedVersion,
        ),
      )
      .sort(
        (a, b) =>
          Number(/_v(\d+)/.exec(b.rfilename)![1]) -
          Number(/_v(\d+)/.exec(a.rfilename)![1]),
      )
      .slice(0, 1);
    for (const file of newer) {
      const version = Number(/_v(\d+)/.exec(file.rfilename)![1]);
      const bytes = fileSize(file);
      if (bytes === undefined || bytes <= 0 || !current || !withinBudget)
        continue;
      const variantBytes =
        bytes + (latestBytes ?? 0) - (fileSize(current) ?? 0);
      result.variants.push({
        name: `Chatterbox Multilingual V${version}`,
        repository: profile.repo,
        revision: latest.sha,
        weightsBytes: variantBytes,
        compatibility:
          version === 3 &&
          variantBytes <= profile.maxBytes &&
          comparableSize(fileSize(current) ?? null, bytes, profile.maxBytes)
            ? "expected_fit"
            : "review_required",
        requiresIntegration: version !== 3,
      });
    }
  }
  // Discover newer family releases only, not bigger models or merely different
  // quantizations. An unfamiliar architecture always requires software review.
  const discovery = discoveryProfile(model);
  if (discovery) {
    result.discovery = "complete";
    try {
      const params = new URLSearchParams({
        author: discovery.author,
        search: discovery.search,
        sort: "createdAt",
        direction: "-1",
        limit: "100",
      });
      const listed = z
        .array(z.object({ id: z.string().max(200) }))
        .max(100)
        .parse(await json(`/api/models?${params}`));
      const candidates = listed
        .filter(
          (item) => item.id !== profile.repo && discovery.isNewer(item.id),
        )
        .slice(0, 2);
      const variants = await Promise.all(
        candidates.map(async (item) => {
          try {
            const meta = await metadata(item.id, "main");
            const bytes = weightsSize(meta.siblings);
            if (bytes === null || bytes <= 0 || bytes > profile.maxBytes)
              return null;
            return {
              name: item.id.split("/")[1],
              repository: item.id,
              revision: meta.sha,
              weightsBytes: bytes,
              compatibility: "review_required",
              requiresIntegration: true,
            } satisfies Variant;
          } catch {
            result.discovery = "unavailable";
            return null;
          }
        }),
      );
      for (const variant of variants)
        if (variant) result.variants.push(variant);
    } catch {
      result.discovery = "unavailable";
    }
  }
  if (result.status === "up_to_date" && result.variants.length)
    result.status = "new_variant";
  result.checkedAt = new Date().toISOString();
  return localModelUpdateSchema.parse(result);
}
function discoveryProfile(model: Model) {
  if (model.variant === "chatterbox-v2" || model.variant === "chatterbox-v3")
    return {
      author: "ResembleAI",
      search: "Chatterbox-Multilingual",
      isNewer: (id: string) => {
        const match = /^ResembleAI\/Chatterbox-Multilingual-[Vv]?(\d+)$/.exec(
          id,
        );
        return Boolean(
          match &&
          Number(match[1]) > (model.variant === "chatterbox-v3" ? 3 : 2),
        );
      },
    };
  if (model.variant === "chatterbox-pt-br")
    return {
      author: "ResembleAI",
      search: "Chatterbox-Multilingual-pt-br",
      isNewer: (id: string) =>
        /^ResembleAI\/Chatterbox-Multilingual-pt-br-[Vv][2-9]\d*$/.test(id),
    };
  if (model.variant === "chatterbox-latam")
    return {
      author: "ResembleAI",
      search: "Chatterbox-Multilingual-es-mx-latam",
      isNewer: (id: string) =>
        /^ResembleAI\/Chatterbox-Multilingual-es-mx-latam-[Vv][2-9]\d*$/.test(
          id,
        ),
    };
  if (model.role === "alignment" || model.role === "recognition") {
    const family = model.role === "alignment" ? "ForcedAligner" : "ASR";
    const pattern = new RegExp(
      `^mlx-community/Qwen(\\d+(?:\\.\\d+)*)-${family}-0\\.6B-8bit$`,
    );
    return {
      author: "mlx-community",
      search: family,
      isNewer: (id: string) => {
        const match = pattern.exec(id);
        return Boolean(
          match &&
          (Number(match[1].split(".")[0]) > 3 ||
            (Number(match[1].split(".")[0]) === 3 &&
              match[1]
                .split(".")
                .slice(1)
                .some((part) => Number(part) > 0))),
        );
      },
    };
  }
  return null;
}
