// Deploy hooks are secrets. Restrict requests to the expected provider and path.
export function isDeployHookUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "api.cloudflare.com" &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.hash &&
      /^\/client\/v4\/workers\/builds\/deploy_hooks\/[^/]+$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}
export interface BuildStatus {
  status: string;
  build_outcome?: string;
  created_on?: string;
  initializing_on?: string;
  running_on?: string;
  stopped_on?: string;
}
export function deploymentStatus(build: BuildStatus): string {
  const outcome = (build.build_outcome ?? "").trim().toLowerCase();
  const status = build.status.trim().toLowerCase();
  if (["success", "succeeded"].includes(outcome)) return "success";
  if (["failure", "failed", "error"].includes(outcome)) return "failed";
  if (["canceled", "cancelled"].includes(outcome)) return "cancelled";
  if (["queued", "pending"].includes(status)) return "queued";
  if (["running", "initializing", "building"].includes(status))
    return "building";
  if (["deploying", "uploading"].includes(status)) return "deploying";
  return "unknown";
}
