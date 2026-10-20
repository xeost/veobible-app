import { bindings } from "./env";
export async function videoFetch(path: string, init: RequestInit = {}) {
  const env = bindings();
  if (!env.DASHBOARD_API_PROXY_TOKEN)
    throw new Error("Configura DASHBOARD_API_PROXY_TOKEN en el dashboard y API_TOKEN en api-proxy");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${env.DASHBOARD_API_PROXY_TOKEN}`);
  return fetch(`${env.VIDEO_API_URL.replace(/\/$/, "")}${path}`, {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(30000),
  });
}
