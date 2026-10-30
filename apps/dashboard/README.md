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

Open <http://localhost:3003>. The initial migration only creates the `admin` user, with password `admin123` stored as a PBKDF2 SHA-256 hash. You can change it from your profile. Configure a random `JWT_SECRET` of at least 32 bytes and a random 32+ character `DASHBOARD_API_PROXY_TOKEN` in the dashboard, matching `API_TOKEN` in `tools/api-proxy/.env`. The child API receives the token from the proxy; engines and assets are configured in [the generator](../../tools/video-project-api/README.md).

Authentication uses HS256 JWTs via jose, with 30-day expiration and HttpOnly/SameSite=Lax cookie, Secure over HTTPS. Each request verifies the active user, role, and `auth_version`; mutations require the same origin. Changing your password or access invalidates previous JWTs. There are no session or login-attempt tables. Administrators manage users, settings, and deployments; editors produce videos.

## Database

`migrations/0001_dashboard.sql` contains the complete schema and a single INSERT: the initial administrator. `0002_query_indexes.sql` adds non-destructive query indexes to existing databases; apply pending migrations before deploying query optimizations. The tables are:

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

Video editor startup prepares waveforms only for open sections, including restored verse links. Closed reading editors mount when opened, and closed narration players defer metadata and waveform loading while retaining header playback. Once visible audio preparation finishes, the editor warms the next reading section's original and enabled generated waveforms in the background; with no reading open, it warms the first reading. All verses within a section share its full-source peaks. Cached server peaks are revalidated by ETag, including after regeneration or replacing a source recording. Foreground loads share unfinished background requests; abandoned requests are canceled. Book projects therefore do not wait for every chapter's waveform before becoming editable.

Settings are stored in `video_projects`. When opening the editor, state is retrieved from the generator: its queue reports if a render is active and files indicate whether an output is available. No render history is saved in D1, and no callbacks are required. The result is retained in `_internal/render-result.json` alongside project files and remains available after restarting the service.

The bottom sidebar widget opens the global narration and video queue. It only shows active or pending tasks, with links to the editor. You can switch projects while generation is processing. The queue is serial, accepts up to 20 tasks, and resides in memory: it does not resume pending tasks after restarting the service. Already generated files remain on disk.

The layout polls the queue every 10 seconds while tasks are active and every 60 seconds when idle. Failed/disconnected queue checks wait 120 seconds. Submitting tasks, opening the queue, or returning to a visible tab refreshes it immediately. The editor checks active renders every 15 seconds and active voices every 10 seconds, serializes requests, and backs off on errors. Automatic polling pauses in hidden tabs. Listings refresh when saving or syncing projects. Catalogue pagination, literal title/ID search, publication filtering, and scope totals run on the server. Requests return at most 100 lightweight rows, ordered by numeric ID; count and page queries share a D1 batch. Superseded requests are aborted and search requests are debounced. Version selectors use a separate count-free identity query. The home summary uses one aggregate scan plus its existing eight-row activity preview. Cleanup and existing-project synchronization restrict reads to the selected project identities. Queue queries select only participant IDs and small display fields, skip D1 entirely when there are no active tasks, and project listings omit passage and settings payloads.

Audio, thumbnails, composition assets, and final videos stream directly from the proxy tunnel to the browser, bypassing the dashboard Worker. The authenticated editor receives an HMAC-signed media grant lasting one hour, scoped to its numeric project ID, Bible version, passage, format, output environment, and dashboard origin. Grants renew before expiration while the editor is visible. The shared `DASHBOARD_API_PROXY_TOKEN` remains private and signs grants; no additional secret or environment variable is required. The proxy validates grants, provides CORS and Range support, and strips grants before forwarding or logging. Existing dashboard media URLs redirect to signed proxy links. Restart the proxy with the updated code before deploying the updated dashboard.

Video editor reads are separated from project initialization and generation settings. Active render state polls every 15 seconds, pending voices every 10 seconds, and alignment discovery every 5 seconds while visible (including idle editors, to discover another tab's work). State and alignment reads use one compact project metadata query and stream responses without loading narration configuration or validating all saved verse offsets. Voice reads select only voice settings and reuse a bounded parsed context cache; exact relevant saved values invalidate it immediately, without a timestamp/TTL window. The service returns conditional state/voice responses and incremental alignment jobs through opaque cursors; completed offset arrays are sent once and results waiting for a local save/application remain in the editor. Restarted services issue new alignment cursor epochs and retain persisted results. Full initialization still runs on focus to refresh saved project metadata and format defaults; focus and polling serialize their requests. Playback grants renew independently via `/api/videos/<id>/media-access` within 15 minutes of expiry, without replacing URLs during normal progress polling. Alignment application requests retrieve only the selected job. Restart api-proxy and its child service after active jobs finish, then deploy the dashboard. No database migration or new secrets are needed.

The audio project editor also uses direct signed proxy links for generated verse recordings, final chapters, original-audio comparisons, downloads and waveform preparation. Audio grants last one hour and are scoped to the edition, book, output environment and dashboard origin. The editor renews them within five minutes of expiry without replacing playback URLs on each progress poll. Compatibility `/api/audios/.../media` and `original-media` URLs redirect instead of streaming through the dashboard. Local media resolution validates owned edition folders, book-relative audio paths and symlinks and works after a service restart without loading a full project snapshot. Restart api-proxy (including its audio service) before deploying this dashboard change; existing shared secrets are reused.

Audio editor inspections use separate `/state` and `/content` requests. Bible text and original-recording availability load once per editor visit; `/content` streams through the dashboard without decoding the book in the Worker. Progress keeps the existing 2.5-second visible-tab cadence. `/state?revision=N` checks a small database header and the generation session cursor, returning a tiny unchanged response when appropriate, without loading recordings or signing media again. Changed state forwards the already-validated stored JSON directly. Original-audio inspections and media-grant renewals also use compact project metadata. Generation opts into `patch-v1` callbacks: only changed recordings, cuts and chapter outputs cross the Worker, with authenticated, sequence-fenced database merge patches. Full snapshots remain available for reconciliation, old clients and stale callback cursors. Restart api-proxy and its child service before deploying the dashboard; finish active generations before restarting. No database migration or new secrets are needed.


`WORKING_DIR` (in `tools/api-proxy/.env`) provides the shared base; `SHORTS_DIR_NAME` and `LONGS_DIR_NAME` (in `tools/video-project-api/.env`) separate the formats beneath it:

- `material/videos/` inside each format directory: video sources.
- `material/audios/` directly inside `WORKING_DIR`: shared Bible chapter audio, organized by version.
- `material/voices/` directly inside `WORKING_DIR`: shared narration samples.
- `outputs/<version>/<passage>/`: production dashboard projects.
- `outputs-dev/<version>/<passage>/`: dashboard in development.

Both environments use the same project structure, with video, thumbnail, texts, and `_internal/` for narrations and auxiliary data. Legacy settings and publication flags can be imported using "Sync existing projects".

## Settings

In `/bible-versions`, administrators create, edit, and delete versions with name, language, and code. Codes are unique within a language; registered versions populate selectors and per-version settings. If there are associated projects, only the name can be modified, preserving references and files for those projects. Versions are not inserted automatically. The options menu offers "Sync versions": it queries the generator, which discovers available versions in `bible-data` and their names from each index's `metadata.name`. Only new language and code pairs are inserted; existing records are neither modified nor deleted.

In `/settings`, the video domain and YouTube, X, Instagram, TikTok, and Facebook accounts are manually configured per language, stored under `social_accounts` in `site_settings`. The domain starts empty, including for existing settings; users must explicitly enter `veobible.com` (or a future language-specific domain) for each language. Empty fields omit the domain or network. Previews and generated videos use the saved domain for their language in the existing reading wordmark and outro, including short, long, and book videos.

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
| `DASHBOARD_API_PROXY_TOKEN`             | Random secret of at least 32 bytes, matching the proxy configuration.                                                              |
| `DASHBOARD_PUBLISH_API_TOKEN` | Optional separate token for reading the public site's Workers Builds, with Workers Builds Read permission.                         |

The publication token uses the account specified by `DASHBOARD_CLOUDFLARE_ACCOUNT_ID`. For manual deployments to a separate publication account, `.env.production` can optionally set `DASHBOARD_PUBLISH_ACCOUNT_ID`. The deployment token is never automatically stored inside the Worker. GitHub secrets use only `DASHBOARD_` names. Deployment scripts map these to Wrangler credentials and Worker bindings (`JWT_SECRET` and `DASHBOARD_API_PROXY_TOKEN`) internally.

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

## Local model inventory

`/admin-tools` is available to every signed-in user, including editors. Its Local AI models tab reads the local service's current configuration and downloaded Hugging Face `main` revisions, with package versions shown separately. Page loading does not load models, download weights, or check remote updates. Each model has an explicit manual update-check action. Missing interpreters, incomplete downloads and custom model workers are reported explicitly. Local paths, credentials and raw diagnostics are not sent to the browser.

The dashboard forwards `GET /api/admin-tools/local-models` to the authenticated `GET /v1/local-models` route through `api-proxy`. Restart the local proxy when deploying this feature so both it and its child service register the new route. Inventory reads share a 30-second cache and concurrent requests share the same inspection. The Refresh button explicitly rechecks local files.

Manual checks use `GET /api/admin-tools/local-models/:id/updates`, forwarded to `GET /v1/local-models/:id/updates`. They compare the files actually used by the configured variant, detect known newer variants (including Multilingual V3 when V2 is selected), and search the same trusted publisher for newer family releases. Different quantizations, larger parameter counts and unrelated language packs are not treated as upgrades. Unknown architectures, software or sizes require review; RAM suitability is an estimate for an M2 with 16 GB, not a measured guarantee. Results are not an instruction to install automatically, and checks neither install nor change models. No scheduled checks run.

The local model table also lists Chatterbox (English), Chatterbox Multilingual pt-BR and Chatterbox es-MX Latam as available alternatives, even when not selected. Their local download status and manual update checks are independent of the active multilingual model. Listing an alternative neither downloads its weights nor changes narration settings; model selection controls are not part of this catalogue.

### Narration model selection

The Local AI Models tab includes a Voice generation settings section with one model selector per Bible language. Authenticated users read/save the global choices through `GET`/`PUT /api/admin-tools/voice-generation`; the validated language-to-model mapping is stored in `site_settings` under `voice_generation_models`. Missing settings default to `multilingual-v3` in all languages, without inserting a database row. No migration is needed.

Both video editors resolve this setting server-side from the project's Bible-version locale, never from an editable request locale. The selected model is included in narration jobs, previews/renders and signed chapter-audio URLs. Jobs retain the model selected when submitted; local environment settings remain fallbacks for callers that omit the model. Existing recordings are retained until regeneration. The inventory's usage labels reflect saved dashboard selections, and saving refreshes the table. Multilingual options always select V3; V2 is not offered in these controls.

### Transient action notifications

The studio layout owns a shared `ToastProvider`, so confirmations survive page navigation and modal closure. Notifications appear at the bottom left, deduplicate repeated messages and retain at most four visible items. Success/info messages expire after five seconds (ten seconds for long text); temporary action errors expire after eight seconds. Hovering or focusing a notification pauses its remaining timeout. Each notification has a localized dismiss button, screen-reader status/alert semantics and reduced-motion styling. While a native modal dialog is open, notifications are portalled inside it so they remain visible and keyboard-accessible in the browser's top layer.

The dashboard message audit moved confirmations for narration-model settings, social settings, Bible-version saves/deletes/sync, project sync and bulk publication edits, published-folder cleanup, project creation/saves, profile updates, narration/publication/project settings modals and publication requests to this system. Temporary action failures such as opening Finder, bulk updates, sync requests or saving accounts/model choices also use error notifications. Field validation, initial loading failures, unresolved form errors, generation progress, model-comparison details, confirmation prompts and instructional notices remain beside their relevant content. Publication history and generation results remain persistent records; notification expiry never changes their state.

The Voices tab in Short Videos, Long Videos, and Book Videos Settings selects default introduction, passage-reading, and closing voices per language, independently per format. New manual and synchronized video projects inherit these choices. The project editor offers Default (Voice N) for each role; inherited choices follow the current format settings when generating, while explicit selections remain fixed. Existing projects keep their explicit choices, with voice 1 retained for older projects, until a user selects Default. Queued requests retain their resolved voice snapshot. Project editors may choose another voice and listen to generated examples, while administrators generate or regenerate those examples in Settings using the current Administration tools narration model and parameters. Examples persist in the shared voice library’s `samples` directory and are served through authenticated dashboard requests. Changing a voice does not replace existing project recordings; regenerate them explicitly.

The Voices settings tab now separates introduction, closing and passage-reading voices by language and format. Passage reading blocks retain their original waveform and can enable an additional generated recording, with independent waveform edits and regeneration controls. Enabling the checkbox reuses existing audio and queues synthesis only when no generated recording exists; disabling it keeps the saved audio but returns the final video to the original recording. When no original exists, the editor keeps the passage text visible and enables generation automatically. Bulk narration queues only enabled reading blocks.

Each language's passage-reading voice tab can optionally override `exaggeration`, `cfg_weight`, `temperature` and `repetition_penalty`. Overrides are saved under `reading_voice_parameters:short` or `reading_voice_parameters:long`, atomically with base voice choices. Disabled overrides inherit the current Administration tools parameters at generation time. They affect new reading generations in existing and new projects, while introductions, closings, chapter announcements, model selection and fixed `min_p`/`top_p` values keep the general configuration. Example generation in the reading tab uses the current editor values, including unsaved overrides; saved recordings are never regenerated by saving settings.

The generated reading toolbar places a regenerate-all button immediately before the playback-speed selector. The button below the waveform regenerates only the selected verse. Reading generation stores one audio per verse in a dedicated block folder and aligns each separately; a derived combined track keeps preview and rendering compatible. The internal block request manages the independent verse requests sequentially. Regenerating one verse preserves its neighbors' recordings and manual timing offsets.

Book Videos (`/book-videos`) uses the shared landscape editor and the `books` working directory (`BOOKS_DIR_NAME` may override its name). Backgrounds are read from `books/material/videos`; generated files are isolated under `books/outputs` and `books/outputs-dev`. Apply migration `0003_book_videos.sql` before using the new format. Sync project presets creates one full-book project per book in the selected Bible version using its chapter and verse counts, without a preset file. Repeated syncs preserve existing projects. Existing-project import is not offered for this format.

## Audio projects

`/audios` adds a chapter-audio workspace beside Book Videos. “Create audio projects” reads registered Bible versions and offers only the next available audio edition for each one. Creation reserves a new edition and adds one project per book, shown in a single catalogue table with an audio edition filter. It never adopts, deletes or overwrites the original library or an older edition. Originals stay in `WORKING_DIR/material/audios/<code>`; new chapters go to `<code>-vN`, with intermediate verse recordings in the sibling `<code>-vN_internal` directory. Project settings and state are stored in the `audio_projects` database table.

Each chapter reuses the passage-reading section header, icon actions, verse picker and shared `VerseWaveform` controls. Only the selected verse recording is loaded in each expanded chapter. Playback speed, zoom, trim handles with keyboard adjustments and edge previews, next-verse playback, and trim resets work on the individual source files; chapter generation and download remain available from the header. Users can choose a voice, regenerate individual verses or a whole chapter, trim each verse, save changes, listen, and download completed chapters. “Generate audios” reuses saved verse recordings and assembles one MP3 per chapter. Completed work survives failed generations and service restarts. The narration model uses the saved Administration tools settings. The project-options menu opens Settings with only the Voices tab: reading voice defaults and optional reading parameters are saved per language under the independent `audio` settings scope. New projects inherit the saved reading voice; existing projects retain their selected voice. Future generations and voice examples use the audio reading parameters, falling back to Administration tools parameters when disabled. Settings also contains one global pause after each verse (0–10 seconds, initially 0.35), shared by every audio project and language. Each new generation snapshots this setting into its resolved verse pauses, overriding old per-verse values; changing it does not modify recordings or running jobs. The generator uses the existing pause contract, so no service restart or database migration is required.

Video editors can choose “Chapter audio source” to use one of these editions while keeping their project's Bible version. Changing the source clears reading timing adjustments and generated-reading overrides and reloads the analysis. Existing projects continue to use original recordings unless another source is selected and saved. Apply migrations `0004_audio_projects.sql` and `0005_audio_project_environments.sql` and restart `api-proxy` to enable the updated audio routes. `audio_projects` has a foreign key to `bible_versions`, unique edition/book identity, saved settings and recording references, status/progress, optimistic revisions and job update fences. Listing and saving projects use the database even while generation is unavailable. The worker sends an authenticated update after each completed verse; callbacks and inspection reconcile progress without storing project manifests on disk. Audio references from the database rehydrate the service after restarts. Bible versions with audio projects cannot be deleted or have their code/language changed.

Audio generation is visible in the shared dashboard queue: each synthesized verse and each chapter assembly has its own entry, chapter/verse identity, status and progress. A submitted operation reserves a serial group in the same queue as video work; a failure preserves completed verses and marks unfinished entries as failed. Queue enrichment resolves audio IDs from `audio_projects` independently of video IDs and checks the output environment. The audio editor uses these entries to show progress inside the corresponding chapter even while collapsed, refresh the sidebar after submission, and detect pending work again on page reload. Different verse or chapter requests from the same book can be appended to the active generation session. Overlapping requests are rejected, while editing stays locked to preserve the saved settings. Each operation reads the latest worker snapshot when it starts, and database callbacks keep the session active until all accepted requests finish. Queue history remains in memory, as with videos; database callbacks continue to persist completed recordings.

Audio editions are isolated by the dashboard's environment, including when development and production share one local generator. Development uses `WORKING_DIR/material/audios/dev/<edition>` for chapter recordings and `WORKING_DIR/material/audios/dev/<edition>_internal` for verse recordings; production keeps the corresponding directories directly under `material/audios`. The dashboard selects the environment on the server and sends it with each request. Version numbering, project listing, edits, jobs, progress updates, playback and video source selection respect that scope. Existing records are classified as production by migration `0005_audio_project_environments.sql`, preserving their files and IDs.

The audio catalogue reuses Book Videos table styling, keyboard/click row navigation, project icons, updated timestamps and the page-size/first/previous/next/last controls. It includes persisted audio edition selection, pinned Bible-version ordering, debounced search and generation-status filtering. The paginated catalogue request (`/api/audios?catalog=1`) filters and counts in the database and returns lightweight rows; verse recordings and project settings are not transferred with catalogue pages. Summary counts describe the selected edition scope, independent of the search and status filters. The existing unpaginated audio response remains available for the video editor's source selector.

Original audio comparisons in the audio project editor are opt-in per chapter; the checkbox stays enabled when navigating between that chapter’s verses, until it is unchecked. The checkbox appears only when that chapter has a regular MP3/M4A file in the unsuffixed original library. Checking it queues chapter-wide ForcedAligner analysis and displays the selected verse in a read-only waveform. Unchecking or changing verses stops playback. Analysis is shared across requests for the same recording, transcript and model configuration, with an in-memory cache (up to 32 completed entries, 30-minute inactivity expiry); failures can be retried. Replacing the original recording or changing its Bible text invalidates the result. Original recordings are shared by both environments, remain read-only and never replace generated recordings or saved trims. Up to eight compact original waveform envelopes are retained in the browser to avoid decoding the chapter again when comparing another verse.

Generated verse waveforms in the audio project editor persist their compact peaks in the browser's bounded waveform cache (32 entries, up to 64 MiB). Their recording revision is part of the cache key, so reopening a cached verse skips fetching and decoding, while regenerating it prepares fresh peaks. Once the current waveform is ready, each open chapter prepares its next verse in the background if a recording exists. Advancing during preparation shares that work; closing the chapter or navigating elsewhere cancels abandoned preparation. Speculative failures are silent and opening the verse retries normally. Persistent storage is optional; if unavailable, the in-memory cache still works.

### Website content bridge

The dashboard owns publication state in `deployments`, exports public content to the private `site-releases` R2 bucket (bound as `WEBSITE_CONTENT`), and authorizes direct downloads through `/api/site-export` with a dedicated `SITE_EXPORT_TOKEN`. Production exports redirect to five-minute presigned R2 URLs, so snapshot bytes bypass the dashboard Worker; local previews stream from the emulator. The frontend no longer supplies a `SiteAdmin` service or stores website release tables.

A production Cron Trigger reconciles deployments and prunes obsolete artifacts every five minutes. Retention preserves two successful releases and active work, with a one-hour upload grace period; audit metadata is limited to 200 recent attempts plus protected records. Local previews overwrite a single local R2 object. See [complete setup and architecture](../../docs/website-publishing.md), including the required `DASHBOARD_SITE_EXPORT_TOKEN`, `DASHBOARD_R2_ACCESS_KEY_ID` and `DASHBOARD_R2_SECRET_ACCESS_KEY` deployment secrets and private R2 bucket.
