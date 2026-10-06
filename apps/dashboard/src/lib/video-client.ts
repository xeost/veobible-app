import { bindings } from "./env";
export async function videoFetch(path: string, init: RequestInit = {}) {
  const env = bindings();
  if (!env.VIDEO_API_TOKEN)
    throw new Error("Configura VIDEO_API_TOKEN en el dashboard y api-proxy");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${env.VIDEO_API_TOKEN}`);
  if (env.CF_ACCESS_CLIENT_ID)
    headers.set("CF-Access-Client-Id", env.CF_ACCESS_CLIENT_ID);
  if (env.CF_ACCESS_CLIENT_SECRET)
    headers.set("CF-Access-Client-Secret", env.CF_ACCESS_CLIENT_SECRET);
  return fetch(`${env.VIDEO_API_URL.replace(/\/$/, "")}${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(30000),
  });
}
