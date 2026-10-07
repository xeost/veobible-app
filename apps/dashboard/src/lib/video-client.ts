import { bindings } from "./env";
export async function videoFetch(path: string, init: RequestInit = {}) {
  const env = bindings();
  if (!env.PROXY_API_TOKEN)
    throw new Error("Configura PROXY_API_TOKEN en el dashboard y api-proxy");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${env.PROXY_API_TOKEN}`);
  return fetch(`${env.VIDEO_API_URL.replace(/\/$/, "")}${path}`, {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(30000),
  });
}
