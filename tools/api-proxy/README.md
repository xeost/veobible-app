# VeoBible API Proxy

Local HTTP proxy based on the example configuration. Starts only `video-project-api`, passes its API token and service configuration without forwarding tunnel credentials, and listens on `127.0.0.1:8420`; the child API uses `127.0.0.1:8422`. Control routes, including `/health`, require the private `API_TOKEN` shared with the dashboard. Browser media GET/HEAD requests instead accept short-lived HMAC-signed grants, scoped to one project, version, passage, format, environment, and dashboard origin. The dashboard issues and refreshes these grants without exposing the API token; media streams directly through the tunnel, bypassing its Worker.

Copy `.env.example` to `.env`, set a random 32+ character `API_TOKEN` and `DASHBOARD_ORIGINS`; run `pnpm start:api-proxy` from the repository root. `WORKING_DIR` defines the shared base directory passed to the video API, which appends its `SHORTS_DIR_NAME` and `LONGS_DIR_NAME` directory names. A crash in the child process stops the proxy. Streaming and Range headers are preserved. Media grants support CORS and downloads, expire after one hour, and cannot authorize generation or queue requests. Grants are stripped from forwarded query strings and proxy logs. Restart the proxy before deploying dashboard changes that use direct media links. Termination signals stop both processes.

In production, install `cloudflared`, configure a named tunnel pointing to `http://127.0.0.1:8420`, set `CLOUDFLARE_TUNNEL_TOKEN` in `tools/api-proxy/.env`, and run `pnpm tunnel:api-proxy`. No tunnels are created or published automatically.

Registered namespaces: `/v1/jobs`, `/v1/projects`, `/v1/analyze`, `/v1/queue`, `/v1/bible-versions`, `/v1/video-project-proposals`, and `/v1/local-models`. `/health` aggregates video availability. To add another API, register its process in `index.mjs` and its routes in `proxy.mjs`; the same tunnel serves both.

See [the dashboard README](../../apps/dashboard/README.md). `pnpm --dir tools/api-proxy test` verifies authentication, routing, forwarding, and upstream disconnection handling.

Both tokens are read exclusively from `tools/api-proxy/.env`. Environment overrides, the legacy `TUNNEL_TOKEN` alias, and tunnel command-line options are not supported. The child API ignores local credential settings and requires startup through the proxy.
