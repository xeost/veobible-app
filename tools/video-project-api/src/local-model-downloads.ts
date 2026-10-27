import { spawn } from "node:child_process";
import { modelKey, setModelEnabled } from "./local-model-state.js";
import {
  verifyModelDownload,
  type ModelDownloadSource,
} from "./local-models.js";
import type {
  LocalModelDownload,
  LocalModels,
} from "./local-models-contract.js";
type Model = LocalModels["models"][number];

export function hfDownloadArguments(source: ModelDownloadSource) {
  return [
    "download",
    source.repository,
    "--revision",
    "main",
    "--max-workers",
    "2",
    ...source.patterns.flatMap((pattern) => ["--include", pattern]),
  ];
}
export function runHfDownload(source: ModelDownloadSource): Promise<void> {
  return new Promise((resolve, reject) => {
    // No shell, private cache, forced download or credentials on the command line.
    const child = spawn("hf", hfDownloadArguments(source), {
      env: {
        ...source.env,
        HF_HUB_DISABLE_TELEMETRY: "1",
        HF_HUB_DISABLE_PROGRESS_BARS: "1",
      },
      stdio: ["ignore", "ignore", "pipe"],
    });
    let diagnostic = "";
    child.stderr.on("data", (chunk) => {
      diagnostic = (diagnostic + String(chunk)).slice(-8000);
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve();
      else {
        console.error("Model download failed", source.repository, diagnostic);
        reject(new Error("Model download failed"));
      }
    });
  });
}
export class LocalModelDownloads {
  private jobs = new Map<string, LocalModelDownload>();
  constructor(
    private options: {
      run?: typeof runHfDownload;
      verify?: typeof verifyModelDownload;
      enable?: typeof setModelEnabled;
      changed?: () => void;
    } = {},
  ) {}
  get busy() {
    return [...this.jobs.values()].some((job) =>
      ["downloading", "verifying"].includes(job.status),
    );
  }
  state(model: Model) {
    return this.jobs.get(modelKey(model));
  }
  clear(model: Model) {
    this.jobs.delete(modelKey(model));
  }
  start(model: Model, plan: ModelDownloadSource[]): LocalModelDownload {
    const current = this.state(model);
    if (current && ["downloading", "verifying"].includes(current.status))
      return current;
    if (this.busy) throw new Error("Another model download is in progress");
    if (!plan.length) throw new Error("Missing download sources");
    const job: LocalModelDownload = {
      status: "downloading",
      startedAt: new Date().toISOString(),
      finishedAt: null,
    };
    this.jobs.set(modelKey(model), job);
    void (async () => {
      try {
        for (const source of plan)
          await (this.options.run ?? runHfDownload)(source);
        job.status = "verifying";
        await (this.options.verify ?? verifyModelDownload)(plan);
        (this.options.enable ?? setModelEnabled)(model, true);
        job.status = "completed";
      } catch (cause) {
        console.error("Could not download model", model.variant, cause);
        job.status = "failed";
      } finally {
        job.finishedAt = new Date().toISOString();
        this.options.changed?.();
      }
    })();
    return job;
  }
  withState(inventory: LocalModels): LocalModels {
    return {
      ...inventory,
      models: inventory.models.map((model) => ({
        ...model,
        ...(this.state(model) ? { download: this.state(model) } : {}),
      })),
    };
  }
}
