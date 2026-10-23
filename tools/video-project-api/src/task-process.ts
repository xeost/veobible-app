import { render, inspection, generateProjectVoice } from "./pipeline.js";
import { alignProjectReading, stopAlignmentWorkers } from "./forced-alignment.js";
import type { TaskRequest, TaskArgs } from "./process-tasks.js";

process.on("message", async ({ id, name, args }: TaskRequest) => {
  const progress = (...values: unknown[]) => {
    if (process.connected) process.send?.({ id, progress: values });
  };
  try {
    let result: unknown;
    switch (name) {
      case "render":
        result = await render(...args as TaskArgs["render"], progress);
        break;
      case "inspection":
        result = await inspection(...args as TaskArgs["inspection"]);
        break;
      case "voice":
        result = await generateProjectVoice(...args as TaskArgs["voice"], progress);
        break;
      case "alignment":
        result = await alignProjectReading(...args as TaskArgs["alignment"], progress);
        break;
      default:
        throw new Error("Unknown task");
    }
    if (process.connected) process.send?.({ id, result });
  } catch (cause) {
    const error = cause instanceof Error ? cause : new Error(String(cause));
    if (process.connected) process.send?.({ id, error: { message: error.message, stack: error.stack } });
  }
});
process.once("exit", stopAlignmentWorkers);
for (const event of ["SIGTERM", "SIGINT", "disconnect"] as const)
  process.once(event, () => {
    stopAlignmentWorkers();
    process.exit(0);
  });
