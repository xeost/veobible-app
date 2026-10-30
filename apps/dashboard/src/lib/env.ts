import { env } from "cloudflare:workers";
export interface Bindings {
  WEBSITE_CONTENT: R2Bucket;
  SITE_EXPORT_TOKEN?: string;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  SITE_DEV_URL?: string;
  SITE_LOCAL?: string;
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
