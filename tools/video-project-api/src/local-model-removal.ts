import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execute = promisify(execFile);
export function hfCacheRemovalArguments(repository: string) {
  if (
    !/^[\w.-]+\/[\w.-]+$/.test(repository) ||
    repository.split("/").some((part) => part === "." || part === "..")
  )
    throw new Error("Invalid model repository");
  return ["cache", "rm", `model/${repository}`, "--yes"];
}
export async function removeCachedRepository(
  repository: string,
  env = process.env,
) {
  // Confirmation belongs to the dashboard. Use the standard shared cache and
  // pass the trusted repository as an argument, never through a shell.
  await execute("hf", hfCacheRemovalArguments(repository), {
    env: { ...env, HF_HUB_DISABLE_TELEMETRY: "1" },
    timeout: 60_000,
    maxBuffer: 128 * 1024,
  });
}
