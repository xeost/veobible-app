# VeoBible Studio

Private dashboard built with Next.js App Router and ViNext. Its API uses an exclusive D1 database for the dashboard. The video generator is an independent service and receives settings from the dashboard.

## Development

Requires Node 22+ and pnpm. Install packages separately:

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

Open <http://localhost:3003>. The initial migration only creates the `admin` user, with password `admin123` stored as a PBKDF2 SHA-256 hash. You can change it from your profile. Configure a random `JWT_SECRET` of at least 32 bytes and the same random 32+ character `VIDEO_API_TOKEN` in both the dashboard and the proxy. The child API receives the token from the proxy; engines and assets are configured in [the generator](../../tools/video-project-api/README.md).

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

## Projects and Generation

Under `/short-videos` and `/long-videos`, "New project" prompts for version, title, short name, and the starting and ending books, chapters, and verses. Long videos require an episode number. Available books and their boundaries are queried from the generator for the selected version; passages are entered manually and can cross book boundaries. The server validates endpoints and rejects duplicate short names within the format and version. There is no static list of passages in the dashboard. Versions are managed under `/bible-versions`. Listings display created projects and distinguish published and unpublished items.

The options menu on each listing offers "Sync project presets". Its modal allows selecting a Bible version and adding format proposals retrieved from the generator. Comparison uses format, version, and the proposal `slug`, stored in `video_projects.slug`. Repeating synchronization does not duplicate projects or overwrite existing titles, passages, settings, or publication flags. New projects adopt current volume settings for that format, language, and version. Titles use the book names of that version, and long formats preserve the episode number.

"Sync existing projects" does not open a modal: it inspects `outputs-dev/<version>/<slug>` in development or `outputs/<version>/<slug>` in production, depending on dashboard environment and format. It only updates the state of already registered projects, matched by format, language, version, and slug; directories without a match are ignored, and new projects are never created by this action. It imports the CLI usage flag as published, audio and verse offsets, volume, audio mode, and background. It preserves titles and settings absent from project files. It does not modify source files. It skips projects with invalid files or active tasks, reporting updated and unchanged counts. Repeating the action without changes preserves update timestamps.

Each project saves `output_environment`: new dashboard projects use their current environment; imported projects use the environment from which they were synced. This allows the editor to query and playback original CLI files even from the development dashboard. The queue includes active tasks from both environments.

The shared editor opens at `/short-videos/<id>` or `/long-videos/<id>` with the numeric project ID. Shorts are vertical 9:16; longs are horizontal 16:9. Intro and outro are fixed sections; each reading segment allows synchronizing verses using waveforms, trimming, and playback. Sections start collapsed, and intro/outro narrations can be generated and played directly from their headers.

Settings are stored in `video_projects`. When opening the editor, state is retrieved from the generator: its queue reports if a render is active and files indicate whether an output is available. No render history is saved in D1, and no callbacks are required. The result is retained in `_internal/render-result.json` alongside project files and remains available after restarting the service.

The bottom sidebar widget opens the global narration and video queue. It only shows active or pending tasks, with links to the editor. You can switch projects while generation is processing. The queue is serial, accepts up to 20 tasks, and resides in memory: it does not resume pending tasks after restarting the service. Already generated files remain on disk.

The layout polls the queue every 3 seconds when there are pending tasks and every 30 seconds when idle; it also polls when submitting tasks, opening the modal, or switching back to the tab. The editor polls periodically only while it has a pending generation. Listings refresh when saving or syncing projects.

`SHORTS_WORKING_DIR` and `LONGS_WORKING_DIR` separate the formats:

- `material/`: video, narration, and Bible audio sources.
- `outputs/<version>/<passage>/`: production and CLI tools.
- `outputs-dev/<version>/<passage>/`: dashboard in development.

Both environments use the CLI structure, with video, thumbnail, texts, and `_internal/` for narrations and auxiliary data. CLI settings and usage flags do not automatically synchronize with the dashboard.

## Settings

In `/bible-versions`, administrators create, edit, and delete versions with name, language, and code. Codes are unique within a language; registered versions populate selectors and per-version settings. If there are associated projects, only the name can be modified, preserving references and files for those projects. Versions are not inserted automatically. The options menu offers "Sync versions": it queries the generator, which discovers available versions in `bible-data` and their names from each index's `metadata.name`. Only new language and code pairs are inserted; existing records are neither modified nor deleted.

In `/settings`, YouTube, X, Instagram, TikTok, and Facebook accounts are manually configured per language, stored under `social_accounts` in `site_settings`. Empty fields omit those networks from the outro.

The Settings modals for each format include "Voice settings" and "Project settings". Intro/outro templates are stored under `voice_templates:short` and `voice_templates:long`. Volume per language and version code is saved under `project_settings:short` and `project_settings:long`; the slider ranges from 0 to 4, with 1 as original volume, and double-click resets to 1. New projects inherit these values, while existing projects keep their settings. No values are preloaded from migrations or scripts.

Each task receives a copy of relevant templates and accounts. The generator does not query D1 directly nor require local accounts or template files.

## Production and Deployments

Create an exclusive D1 database for the dashboard and configure its UUID in `env.production.d1_databases` within `wrangler.jsonc`. Set `VIDEO_API_URL` to the tunnel hostname and store `JWT_SECRET`, `VIDEO_API_TOKEN`, and any Cloudflare Access credentials as Worker secrets. Prepare the database with the single migration. Build with `pnpm --dir apps/dashboard build:production` and publish explicitly with Wrangler using the generated `dist/server/wrangler.json`.

The browser communicates exclusively with the dashboard, which communicates with the local proxy or over HTTPS/tunnel. Configure `DASHBOARD_ORIGINS` in the proxy and refer to [its documentation](../../tools/api-proxy/README.md) for tunnel setup.

Deployments publishes the public VeoBible site. "Configure" stores the deploy hook in `site_settings`, under key `deploy_hook:veobible:site`. An empty string disables publishing; `SITE_DEPLOY_HOOK` serves as fallback only if no setting is saved. `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` enable querying Workers Builds. Deployment history is independent of video generation.

## Verification

```sh
pnpm --dir apps/dashboard typecheck
pnpm --dir apps/dashboard test
pnpm --dir apps/dashboard build
pnpm --dir tools/video-project-api check
pnpm --dir tools/video-project-api test:render
pnpm --dir tools/api-proxy test
```
