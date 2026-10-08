# VeoBible Studio

Private dashboard built with Next.js App Router and ViNext. Its API uses an exclusive D1 database for the dashboard. The video generator is an independent service and receives settings from the dashboard.

## Development

Requires Node 24+ and pnpm 11.11.0. Install packages separately:

```sh
pnpm --dir apps/dashboard install
pnpm --dir tools/video-project-api install
cp apps/dashboard/.dev.vars.example apps/dashboard/.dev.vars
cp tools/api-proxy/.env.example tools/api-proxy/.env
cp tools/video-project-api/.env.example tools/video-project-api/.env
pnpm db:dashboard:local
pnpm start:api-proxy
# In another terminal:
pnpm dev:dashboard
```

Open <http://localhost:3003>. The initial migration only creates the `admin` user, with password `admin123` stored as a PBKDF2 SHA-256 hash. You can change it from your profile. Configure a random `JWT_SECRET` of at least 32 bytes and the same random 32+ character `PROXY_API_TOKEN` in both the dashboard and the proxy. The child API receives the token from the proxy; engines and assets are configured in [the generator](../../tools/video-project-api/README.md).

Authentication uses HS256 JWTs via jose, with 30-day expiration and HttpOnly/SameSite=Lax cookie, Secure over HTTPS. Each request verifies the active user, role, and `auth_version`; mutations require the same origin. Changing your password or access invalidates previous JWTs. There are no session or login-attempt tables. Administrators manage users, settings, and deployments; editors produce videos.

## Database

`migrations/0001_dashboard.sql` contains the complete schema and a single INSERT: the initial administrator. The tables are:

- `dashboard_users`: users and authentication.
- `bible_versions`: Bible versions identified by language and code.
- `video_projects`: passage, version, format, settings, and usage flag.
- `site_settings`: configuration by key.
- `deployments`: public site publications.

IDs for users, versions, projects, and deployments are auto-incrementing integers. `site_settings` uses its natural key. There are no `catalog`, `jobs`, `projects`, `users`, `versions`, or `version_settings` tables. Projects do not have status or publication fields.

```sh
pnpm --dir apps/dashboard db:migrate:local
# Only for a production database prepared for this schema:
pnpm --dir apps/dashboard db:migrate:remote
```

Consolidation replaces prior history and requires rebuilding an existing database; it is not an incremental migration of existing data. Wrangler tracks migrations in `d1_migrations`. The local database is stored in `apps/dashboard/.wrangler/state/v3/d1`. There are no automated project or settings insertions.

Keep the root `d1_databases` binding in `wrangler.jsonc` for development; configure the real production database only under `env.production.d1_databases`. The local emulator selects its SQLite database using the binding's database ID, so changing the root ID opens a different local database instead of reusing existing data. The root configuration also uses the local video proxy, while production uses its HTTPS tunnel.

## Projects and Generation

The generation modal has Queue and History tabs. History lists recent completed or failed intro narration, closing narration, and video renders, newest first, with links to their existing projects. These records come from the generator's in-memory queue and disappear when it restarts. Tasks for deleted projects are omitted. History is requested only while the modal is open; sidebar polling continues to query active tasks only.

Under `/short-videos` and `/long-videos`, "New project" prompts for version, title, short name, and the starting and ending books, chapters, and verses. Long videos require an episode number. Available books and their boundaries are queried from the generator for the selected version; passages are entered manually and can cross book boundaries. The server validates endpoints and rejects duplicate short names within the format and version. There is no static list of passages in the dashboard. Versions are managed under `/bible-versions`. Listings display created projects and distinguish published and unpublished items.

The options menu on each listing offers "Sync project presets". Its modal allows selecting a Bible version and adding format proposals retrieved from the generator. Comparison uses format, version, and the proposal `slug`, stored in `video_projects.slug`. Repeating synchronization does not duplicate projects or overwrite existing titles, passages, settings, or publication flags. New projects adopt current volume settings for that format, language, and version. Titles use the book names of that version, and long formats preserve the episode number.

"Sync existing projects" does not open a modal: it inspects `outputs-dev/<version>/<slug>` in development or `outputs/<version>/<slug>` in production, depending on dashboard environment and format. It only updates the state of already registered projects, matched by format, language, version, and slug; directories without a match are ignored, and new projects are never created by this action. It imports legacy usage flags as publication status, audio and verse offsets, volume, audio mode, and background. It preserves titles and settings absent from project files. It does not modify source files. It skips projects with invalid files or active tasks, reporting updated and unchanged counts. Repeating the action without changes preserves update timestamps.

The dashboard derives the output environment from its runtime configuration and passes it to the video API; no environment field is stored on individual projects. Production and development use separate databases and output directories.

The shared editor opens at `/short-videos/<id>` or `/long-videos/<id>` with the numeric project ID. Shorts are vertical 9:16; longs are horizontal 16:9. Intro and outro are fixed sections; each reading segment allows synchronizing verses using waveforms, trimming, and playback. Sections start collapsed, and intro/outro narrations can be generated and played directly from their headers.

Settings are stored in `video_projects`. When opening the editor, state is retrieved from the generator: its queue reports if a render is active and files indicate whether an output is available. No render history is saved in D1, and no callbacks are required. The result is retained in `_internal/render-result.json` alongside project files and remains available after restarting the service.

The bottom sidebar widget opens the global narration and video queue. It only shows active or pending tasks, with links to the editor. You can switch projects while generation is processing. The queue is serial, accepts up to 20 tasks, and resides in memory: it does not resume pending tasks after restarting the service. Already generated files remain on disk.

The layout polls the queue every 10 seconds while tasks are active and every 60 seconds when idle. Failed/disconnected queue checks wait 120 seconds. Submitting tasks, opening the queue, or returning to a visible tab refreshes it immediately. The editor checks active renders every 15 seconds and active voices every 10 seconds, serializes requests, and backs off on errors. Automatic polling pauses in hidden tabs. Listings refresh when saving or syncing projects. Queue queries select only participant IDs and small display fields, skip D1 entirely when there are no active tasks, and project listings omit passage and settings payloads.

Audio, thumbnails, composition assets, and final videos stream directly from the proxy tunnel to the browser, bypassing the dashboard Worker. The authenticated editor receives an HMAC-signed media grant lasting one hour, scoped to its numeric project ID, Bible version, passage, format, output environment, and dashboard origin. Grants renew before expiration while the editor is visible. The shared `PROXY_API_TOKEN` remains private and signs grants; no additional secret or environment variable is required. The proxy validates grants, provides CORS and Range support, and strips grants before forwarding or logging. Existing dashboard media URLs redirect to signed proxy links. Restart the proxy with the updated code before deploying the updated dashboard.

`SHORTS_WORKING_DIR` and `LONGS_WORKING_DIR` separate the formats:

- `material/`: video, narration, and Bible audio sources.
- `outputs/<version>/<passage>/`: production dashboard projects.
- `outputs-dev/<version>/<passage>/`: dashboard in development.

Both environments use the same project structure, with video, thumbnail, texts, and `_internal/` for narrations and auxiliary data. Legacy settings and publication flags can be imported using "Sync existing projects".

## Settings

In `/bible-versions`, administrators create, edit, and delete versions with name, language, and code. Codes are unique within a language; registered versions populate selectors and per-version settings. If there are associated projects, only the name can be modified, preserving references and files for those projects. Versions are not inserted automatically. The options menu offers "Sync versions": it queries the generator, which discovers available versions in `bible-data` and their names from each index's `metadata.name`. Only new language and code pairs are inserted; existing records are neither modified nor deleted.

In `/settings`, YouTube, X, Instagram, TikTok, and Facebook accounts are manually configured per language, stored under `social_accounts` in `site_settings`. Empty fields omit those networks from the outro.

The Settings modals for each format include "Voice settings" and "Project settings". Intro/outro templates are stored under `voice_templates:short` and `voice_templates:long`. Volume per language and version code is saved under `project_settings:short` and `project_settings:long`; the slider ranges from 0 to 4, with 1 as original volume, and double-click resets to 1. New projects inherit these values, while existing projects keep their settings. No values are preloaded from migrations or scripts.

Each task receives a copy of relevant templates and accounts. The generator does not query D1 directly nor require local accounts or template files.

## Production and Deployments

The production Worker is `veobible-dashboard`, served at <https://dash.veobible.com>. Its custom domain requires an active Cloudflare zone. Worker preview URLs and the `workers.dev` hostname are disabled. Local development uses a separate Worker configuration and the proxy at port 8430.

The GitHub Action in `.github/workflows/deploy-dashboard.yml` validates pull requests, then deploys pushes to `main` and manual runs through the GitHub `production` environment. It installs both the dashboard and video project packages because the editor shares video compositions with the generator. Deployments are serialized to avoid overlapping migrations.

Database bindings, the proxy URL, and the dashboard domain are configured directly in `wrangler.jsonc` under `env.production`. No GitHub Actions variables are required.

Configure these GitHub secrets in the repository or its `production` environment:

| Secret                        | Purpose                                                                                                                            |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `DASHBOARD_CLOUDFLARE_ACCOUNT_ID`       | Cloudflare account hosting the Worker and D1 database.                                                                             |
| `DASHBOARD_CLOUDFLARE_API_TOKEN`        | Deployment credential with Workers Scripts Write, D1 Edit, and Workers Routes Write permissions for the relevant account and zone. |
| `DASHBOARD_JWT_SECRET`                  | Random authentication secret of at least 32 bytes.                                                                                 |
| `DASHBOARD_PROXY_API_TOKEN`             | Random secret of at least 32 bytes, matching the proxy configuration.                                                              |
| `DASHBOARD_PUBLISH_API_TOKEN` | Optional separate token for reading the public site's Workers Builds, with Workers Builds Read permission.                         |

The publication token uses the account specified by `DASHBOARD_CLOUDFLARE_ACCOUNT_ID`. For manual deployments to a separate publication account, `.env.production` can optionally set `DASHBOARD_PUBLISH_ACCOUNT_ID`. The deployment token is never automatically stored inside the Worker. GitHub secrets use only `DASHBOARD_` names. Deployment scripts map these to Wrangler credentials and Worker bindings (`JWT_SECRET` and `PROXY_API_TOKEN`) internally.

The production build validates `wrangler.jsonc` and rejects placeholder database IDs, example proxy URLs, or invalid domains. Before migrating, the Action checks required credentials and performs a deployment dry run. The deployment uploads runtime secrets together with the Worker using a temporary file with restricted permissions. Optional secrets omitted from later runs retain their existing values; delete them explicitly with Wrangler when no longer needed.

The initial migration creates only `admin` with password `admin123`. Change this password from the profile after the first deployment. Settings, versions, and projects are configured manually through the interface.

For a manual deployment, copy `.env.production.example` to the ignored `.env.production`, fill in its values, and run:

```sh
pnpm --dir apps/dashboard build:production
pnpm --dir apps/dashboard deploy:production --check
pnpm --dir apps/dashboard deploy:production --dry-run
pnpm --dir apps/dashboard db:migrate:remote
pnpm --dir apps/dashboard deploy:production
```

The build updates only the production configuration in `wrangler.jsonc`. Production is selected during compilation with `CLOUDFLARE_ENV=production`; deployment uses the generated `dist/server/wrangler.json` without `--env`, following [Cloudflare's Vite environment guidance](https://developers.cloudflare.com/workers/vite-plugin/reference/migrating-from-wrangler-dev/). Database migrations use the source configuration with `--env production`. The video services and their working directories remain on their own host; GitHub does not start them. All dashboard pages retain their `noindex` metadata and response header.

The browser communicates exclusively with the dashboard, which communicates with the local proxy or over HTTPS/tunnel. Configure `DASHBOARD_ORIGINS` in the proxy and refer to [its documentation](../../tools/api-proxy/README.md) for tunnel setup.

Deployments publishes the public VeoBible site. "Configure" stores the deploy hook in `site_settings`, under key `deploy_hook:veobible:site`. The saved database value is the only source of this configuration. A missing or empty value disables publishing. `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` enable querying Workers Builds. Deployment history is independent of video generation.

## Verification

```sh
pnpm --dir apps/dashboard typecheck
pnpm --dir apps/dashboard test
pnpm --dir apps/dashboard build
pnpm --dir tools/video-project-api check
pnpm --dir tools/video-project-api test:render
pnpm --dir tools/api-proxy test
```
