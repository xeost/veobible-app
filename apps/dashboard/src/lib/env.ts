import { env } from "cloudflare:workers";
export interface Bindings {
  DB: D1Database;
  JWT_SECRET: string;
  VIDEO_API_URL: string;
  DASHBOARD_API_PROXY_TOKEN: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
}
export function bindings(): Bindings {
  return env as unknown as Bindings;
}
export function db() {
  return bindings().DB;
}
