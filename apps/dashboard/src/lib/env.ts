import { env } from "cloudflare:workers";
export interface Bindings {
  DB: D1Database;
  VIDEO_API_URL: string;
  VIDEO_API_TOKEN: string;
  DASHBOARD_CALLBACK_URL: string;
  CF_ACCESS_CLIENT_ID?: string;
  CF_ACCESS_CLIENT_SECRET?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  SITE_DEPLOY_HOOK?: string;
}
export function bindings(): Bindings {
  return env as unknown as Bindings;
}
export function db() {
  return bindings().DB;
}
