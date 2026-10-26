import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import {
  alignmentWorkerConfig,
  alignmentWorkerRoot,
} from "./alignment-config.js";
import {
  localModelsSchema,
  localModelStatusSchema,
  type LocalModels,
} from "./local-models-contract.js";

import { qwenPython } from "./narration-runtime.js";
const execute = promisify(execFile);
const probeFile = fileURLToPath(
  new URL("./local-model-inventory.py", import.meta.url),
);
const voiceRoot = fileURLToPath(
  new URL("../../voice-generator/", import.meta.url),
);
type VoiceConfig = {
  ttsProvider: string;
  ttsModels: Record<"es" | "en" | "pt", string>;
  ttsPython: string;
  ttsScript: string;
};
type Model = LocalModels["models"][number];
type ProbeModel = {
  repository: string | null;
  localPath?: string;
  required: string[];
};
type Probe = (
  python: string,
  request: { package: string; models: ProbeModel[] },
  env: NodeJS.ProcessEnv,
) => Promise<unknown>;
const probeSchema = z.object({
  version: z.string().max(100).nullable(),
  models: z.array(
    z.object({
      status: localModelStatusSchema,
      revision: z.string().nullable(),
    }),
  ),
});
const repoPattern = /^[\w.-]+\/[\w.-]+$/;
const probe: Probe = async (python, request, env) => {
  const { stdout } = await execute(
    python,
    ["-B", probeFile, JSON.stringify(request)],
    {
      env: { ...env, HF_HUB_OFFLINE: "1", HF_HUB_DISABLE_TELEMETRY: "1" },
      timeout: 8000,
      maxBuffer: 128 * 1024,
    },
  );
  return JSON.parse(stdout);
};

export async function loadLocalModels(
  options: {
    voices?: { short: VoiceConfig; long: VoiceConfig };
    alignment?: ReturnType<typeof alignmentWorkerConfig>;
    env?: NodeJS.ProcessEnv;
    probe?: Probe;
  } = {},
): Promise<LocalModels> {
  const voices = options.voices ?? {
    short: (await import("./engines/short/config.js")).config,
    long: (await import("./engines/long/config.js")).config,
  };
  const alignment = options.alignment ?? alignmentWorkerConfig();
  const env = options.env ?? process.env;
  const entries: Array<{
    model: Model;
    python: string;
    env: NodeJS.ProcessEnv;
    probe: ProbeModel;
    custom: boolean;
  }> = [];
  const add = (
    name: string,
    role: Model["role"],
    source: string,
    required: string[],
    python: string,
    environment: NodeJS.ProcessEnv,
    uses: Model["uses"],
    custom = false,
  ) => {
    const repository =
      repoPattern.test(source) && !existsSync(source) ? source : null;
    const variant: Model["variant"] = custom
      ? "custom"
      : repository === "Qwen/Qwen3-TTS-12Hz-0.6B-Base"
        ? "qwen3-base-0.6b"
        : repository === "Qwen/Qwen3-TTS-12Hz-1.7B-Base"
          ? "qwen3-base-1.7b"
          : repository === "ResembleAI/chatterbox"
            ? required.includes("t3_cfg.safetensors")
              ? "chatterbox-original"
              : required.includes("t3_mtl23ls_v3.safetensors")
                ? "chatterbox-v3"
                : required.includes("t3_mtl23ls_v2.safetensors")
                  ? "chatterbox-v2"
                  : "chatterbox-shared"
            : repository === "ResembleAI/Chatterbox-Multilingual-es-mx-latam"
              ? "chatterbox-latam"
              : repository === "ResembleAI/Chatterbox-Multilingual-pt-br"
                ? "chatterbox-pt-br"
                : role === "alignment" &&
                    repository === "mlx-community/Qwen3-ForcedAligner-0.6B-8bit"
                  ? "qwen3-aligner-0.6b-8bit"
                  : role === "recognition" &&
                      repository === "mlx-community/Qwen3-ASR-0.6B-8bit"
                    ? "qwen3-asr-0.6b-8bit"
                    : "custom";
    const previous = entries.find(
      (entry) =>
        entry.model.name === name &&
        (entry.model.variant === variant ||
          variant === "chatterbox-shared" ||
          entry.model.variant === "chatterbox-shared") &&
        entry.python === python &&
        entry.model.repository === repository &&
        entry.probe.localPath === (repository ? undefined : source) &&
        entry.env.HF_HOME === environment.HF_HOME &&
        entry.custom === custom,
    );
    if (previous) {
      if (variant === "chatterbox-v2" || variant === "chatterbox-v3")
        previous.model.variant = variant;
      previous.probe.required = [
        ...new Set([...previous.probe.required, ...required]),
      ];
      for (const use of uses) {
        const existing = previous.model.uses.find(
          (item) => item.kind === use.kind,
        );
        if (existing)
          existing.languages = [
            ...new Set([...existing.languages, ...use.languages]),
          ];
        else
          previous.model.uses.push({ ...use, languages: [...use.languages] });
      }
      return;
    }
    entries.push({
      model: {
        id: `local-model-${entries.length + 1}`,
        name,
        role,
        uses: uses.map((use) => ({ ...use, languages: [...use.languages] })),
        repository,
        revision: null,
        status: custom ? "custom" : "unavailable",
        variant,
        software: {
          name: variant.startsWith("qwen3-base-")
            ? "qwen-tts"
            : role === "voice"
              ? "chatterbox-tts"
              : "mlx-audio",
          version: null,
        },
      },
      python,
      env: environment,
      probe: {
        repository,
        ...(repository ? {} : { localPath: source }),
        required,
      },
      custom,
    });
  };
  for (const kind of ["short", "long"] as const) {
    const config = voices[kind];
    if (config.ttsProvider !== "chatterbox") continue;
    const groups = new Map<string, Array<"es" | "en" | "pt">>();
    for (const language of ["es", "en", "pt"] as const) {
      const name = config.ttsModels[language];
      groups.set(name, [...(groups.get(name) ?? []), language]);
    }
    for (const [model, languages] of groups) {
      const uses = [{ kind, languages }];
      const custom =
        path.resolve(config.ttsScript) !== path.join(voiceRoot, "cli.py") ||
        ![
          "multilingual",
          "multilingual-v3",
          "multilingual-v2",
          "latam",
        ].includes(model);
      if (custom) {
        add(
          "Custom narration model",
          "voice",
          "",
          [],
          config.ttsPython,
          env,
          uses,
          true,
        );
        continue;
      }
      add(
        "Chatterbox Multilingual",
        "voice",
        "ResembleAI/chatterbox",
        model !== "latam"
          ? [
              "ve.pt",
              "s3gen.pt",
              model === "multilingual-v2"
                ? "t3_mtl23ls_v2.safetensors"
                : "t3_mtl23ls_v3.safetensors",
              "grapheme_mtl_merged_expanded_v1.json",
            ]
          : ["ve.pt", "s3gen.pt", "grapheme_mtl_merged_expanded_v1.json"],
        config.ttsPython,
        env,
        uses,
      );
      if (model === "latam")
        add(
          "Chatterbox es-MX Latam",
          "voice",
          "ResembleAI/Chatterbox-Multilingual-es-mx-latam",
          [
            "t3_es_mx_latam.safetensors",
            "grapheme_mtl_merged_expanded_v1.json",
          ],
          config.ttsPython,
          env,
          uses,
        );
    }
  }
  // Alternatives are listed once. Active entries retain their actual interpreter/uses.
  const cataloguePython = (
    Object.values(voices).find(
      (config) =>
        config.ttsProvider === "chatterbox" &&
        path.resolve(config.ttsScript) === path.join(voiceRoot, "cli.py"),
    ) ?? voices.short
  ).ttsPython;
  const catalogue: Array<[string, string, string[]]> = [
    [
      "Chatterbox Multilingual",
      "ResembleAI/chatterbox",
      [
        "ve.pt",
        "s3gen.pt",
        "t3_mtl23ls_v3.safetensors",
        "grapheme_mtl_merged_expanded_v1.json",
      ],
    ],
    [
      "Chatterbox",
      "ResembleAI/chatterbox",
      [
        "ve.safetensors",
        "t3_cfg.safetensors",
        "s3gen.safetensors",
        "tokenizer.json",
        "conds.pt",
      ],
    ],
    [
      "Chatterbox Multilingual pt-BR",
      "ResembleAI/Chatterbox-Multilingual-pt-br",
      [
        "t3_pt_br.safetensors",
        "s3gen_v3.pt",
        "grapheme_mtl_merged_expanded_v1.json",
      ],
    ],
    [
      "Chatterbox es-MX Latam",
      "ResembleAI/Chatterbox-Multilingual-es-mx-latam",
      ["t3_es_mx_latam.safetensors", "grapheme_mtl_merged_expanded_v1.json"],
    ],
  ];
  for (const [name, repository, required] of catalogue) {
    if (
      entries.some(
        (entry) =>
          entry.model.name === name &&
          (name !== "Chatterbox Multilingual" ||
            entry.model.variant === "chatterbox-v3") &&
          entry.model.repository === repository &&
          !entry.custom,
      )
    )
      continue;
    add(name, "voice", repository, required, cataloguePython, env, []);
  }
  for (const size of ["0.6", "1.7"]) {
    add(
      `Qwen3-TTS Base ${size}B`,
      "voice",
      `Qwen/Qwen3-TTS-12Hz-${size}B-Base`,
      [
        "config.json",
        "model*.safetensors",
        "tokenizer_config.json",
        "preprocessor_config.json",
        "generation_config.json",
        "vocab.json",
        "merges.txt",
        "speech_tokenizer/config.json",
        "speech_tokenizer/preprocessor_config.json",
        "speech_tokenizer/model.safetensors",
      ],
      qwenPython,
      env,
      [],
    );
  }
  const alignmentEnv = env;
  const customAlignment =
    path.resolve(alignment.script) !== path.join(alignmentWorkerRoot, "cli.py");
  const uses = (["short", "long"] as const).map((kind) => ({
    kind,
    languages: ["es", "en", "pt"] as Array<"es" | "en" | "pt">,
  }));
  add(
    customAlignment
      ? "Custom alignment model"
      : repoPattern.test(alignment.model)
        ? alignment.model.split("/")[1]
        : "Local alignment model",
    "alignment",
    alignment.model,
    ["config.json", "*.safetensors"],
    alignment.python,
    alignmentEnv,
    uses,
    customAlignment,
  );
  add(
    customAlignment
      ? "Custom recognition model"
      : repoPattern.test(alignment.asrModel)
        ? alignment.asrModel.split("/")[1]
        : "Local recognition model",
    "recognition",
    alignment.asrModel,
    ["config.json", "*.safetensors"],
    alignment.python,
    alignmentEnv,
    uses,
    customAlignment,
  );
  // Group by the actual interpreter and cache context; inspect each environment
  // once even when several formats/languages share it. No model is imported.
  const groups = new Map<string, typeof entries>();
  for (const entry of entries.filter((entry) => !entry.custom)) {
    const key = JSON.stringify([
      entry.python,
      entry.env.HF_HOME,
      entry.env.HF_HUB_CACHE,
      entry.env.HUGGINGFACE_HUB_CACHE,
      entry.model.software.name,
    ]);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  await Promise.all(
    [...groups.values()].map(async (group) => {
      try {
        const result = probeSchema.parse(
          await (options.probe ?? probe)(
            group[0].python,
            {
              package: group[0].model.software.name,
              models: group.map((entry) => entry.probe),
            },
            group[0].env,
          ),
        );
        if (result.models.length !== group.length)
          throw new Error("Invalid local model inventory");
        group.forEach((entry, index) => {
          entry.model.status = result.models[index].status;
          entry.model.revision = result.models[index].revision;
          entry.model.software.version = result.version;
        });
      } catch {
        group.forEach((entry) => {
          entry.model.status = "unavailable";
        });
      }
    }),
  );
  return localModelsSchema.parse({
    checkedAt: new Date().toISOString(),
    models: entries.map((entry) => entry.model),
  });
}
