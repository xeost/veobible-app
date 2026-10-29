# Website publications

The dashboard owns editable video projects. Social publication (`video_projects.published`)
keeps its existing meaning. `/website` reads published short and long projects, stores
website-specific descriptions and inclusion flags, and lets administrators exclude
individual pages. Video editor pages are unchanged. `/deployments` links to `/website`;
the shared dashboard navigation is unchanged.

## Data and permissions

- Dashboard D1: `video_projects.social_video_ids` stores social platform IDs as a JSON object
  (for example, `{"youtube":"abcdefghijk","instagram":"another-id"}`). Website-specific
  descriptions and inclusion flags remain in `pages_from_video_projects`, keyed by
  `video_project_id`. Imported channel videos,
  version/date source rules and deployment history are separate. Book-video links are derived
  from published book projects; there is no `website_books` table.
- Frontend D1: immutable, validated public content snapshots, deployment lock, development and
  deployed revision pointers. No renderer settings or private user information is exported.
- Dashboard `SITE_API` service binding calls the named `SiteAdmin` entrypoint of
  `veobible-app`. The same entrypoint is exported by production and `dev:api`.
- Administrators use existing authenticated dashboard endpoints and same-origin checks.
  RPC methods are not exposed as public HTTP endpoints.
- `/api/site-export` requires `SITE_EXPORT_TOKEN` in production. This credential grants
  read access only to the public editorial export. The build never receives D1 or dashboard
  credentials. The `SITE_LOCAL` bypass exists only in the generated local API configuration.

## Local development

Use Node.js 24 or newer, consistently with the dashboard. The build scripts load the
shared TypeScript contract through native Node.js support. If overriding the Cloudflare
build runtime, set `NODE_VERSION=24`; see the [build image reference](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/).

Apply the local migrations once after pulling:

```sh
pnpm --dir apps/frontend db:migrate:local
pnpm --dir apps/dashboard db:migrate:local
```

Run each command in a terminal:

```sh
pnpm dev:api
pnpm dev:dashboard
pnpm dev:site
```

Wrangler and the Cloudflare Vite plugin discover the running API by worker name, even
across separate processes. The API uses its existing local D1 state. No remote bindings
are configured. A disconnected API does not fall back to production.

Open `/website` from `/deployments`. Its page listings are split into Daily dose of God
(short projects) and Bible in 365 days (long projects), with server-side search, version and
inclusion filters, and 10/20/50/100-row pagination. Clicking a row opens the description editor;
inclusion is changed directly from the table. Description-only updates preserve inclusion
and vice versa. The dialog closes on backdrop click or Escape and scrolls only its body.

Website edits remain in the dashboard until explicitly applied. In development, open
`/deployments` and press **Dev Build** to validate and save a development snapshot.
The button is shown only with the local `SITE_LOCAL=true` binding and disabled when
there are no content changes, invalid included pages, or a disconnected local service.
Both the dashboard endpoint and the receiving RPC reject development builds in production.
Opening or refreshing `/website`, editing descriptions, toggling inclusion, and detecting
social videos do not update the development snapshot.

`dev:site` polls the selected local development snapshot every three seconds and writes
an ignored generated module only when its content changes; Next.js watches that module
for hot reload. Failed connections preserve the last loaded content. Section listings are
initially empty until the first Dev Build. This action does not run a production build or
create a production deployment/history entry.

To run the site on another port, update the dashboard's local `SITE_DEV_URL`.
The default is `http://localhost:3000`. Website page links point there in development.
Saved changes appear on the local site only after Dev Build, and on the public site only
after a successful production deployment.

## Social video cache

`social_video_cache` stores public query results for YouTube, Instagram, TikTok, Facebook
and X. Its composite primary key is `(platform, video_id)`: identifiers from different
platforms cannot collide. `account` identifies the channel/account; `title`, `published_at`,
`description` and JSON `metadata` hold its public data. An index on platform/account/date
supports scoped lookups. Reads and updates must always specify the platform.

The shared cache repository handles all five platforms and treats their video IDs as opaque
strings. Only the YouTube detector is currently implemented. Its parser still uses internal
YouTube-specific names, which are mapped to the generic cache fields at the storage boundary.
Other networks can use the same repository without changing YouTube processing.

## YouTube import

The Videos on social media tab in `/website` replaces `apps/frontend/scripts/import-youtube-videos.py`:

1. Configure the YouTube channels by language in `/settings`. In `/website`, configure only
   the first publication date and enabled state for each version; channel names are read-only.
2. Save the rules, then start detection for one channel or all enabled channels. The dashboard
   sends bounded requests while the page remains open. There are no manual video-ID inputs.
3. Every step selects published projects without a YouTube ID and matches the existing
   `social_video_cache` cache first. If nothing remains to find, YouTube is never contacted.
4. Only unresolved projects trigger public HTML catalog requests, newest first (`sort=dd`).
   Long/book projects use Videos; short projects use Shorts. With both types pending,
   the recent page of each catalog is checked before older pages, alternating by pages read.
   Continuations are followed only while unresolved projects remain. Requests use Worker-supported
   manual redirect handling; unexpected redirects are rejected without following them. There is no developer API key and
   no RSS dependency. The catalog is not imported wholesale.
5. All videos encountered on a fetched page are cached, including unrelated videos. The
   next step can reuse them without another catalog request. A single SQL statement saves
   each page. At most 20 project associations are committed per step.
6. Detection stops as soon as the missing IDs are resolved. A run is capped at 20 outbound
   requests; an unfinished cursor can be continued later. Leaving the page stops continuation,
   while already cached videos and project IDs remain saved.

The worker uses an atomic, shared D1 lease in `site_settings.youtube_fetch_gate` across
channels and concurrent requests. It waits **five seconds before every YouTube request**;
the lease spans the wait, fetch, parsing and cache commit. Concurrent runs wait rather than
fetch in parallel. A blocked/rate-limited response pauses outbound requests for 15 minutes.
Repeated unchanged unsuccessful searches reuse their state for at least one minute instead
of immediately fetching the same page. Scan state and continuation context live under
`site_settings.youtube_scan:<channel>`.

`social_video_cache.metadata` records the catalog tab and conservative date ranges from relative
publication labels. A range is accepted when its earliest possible date is on or after
the project's own version start date, and rejected when its latest date is before that minimum. Missing or uncertain dates trigger a watch-page date lookup **only
for matching candidates**, never for every incidental video. Failed date verification leaves
an uncertain candidate unassociated; it is not assigned a guessed publication date.

The partial index `video_projects_pending_youtube` contains only socially published
short/long/book projects whose YouTube ID is missing, null or empty. It uses the same
predicate as the pending-project query and orders by descending project ID. Saving an ID
or clearing social publication removes the row from this index automatically. Query-plan
coverage verifies its use with a representative catalog of 10,000 already identified videos.

IDs are saved to `video_projects.social_video_ids.youtube`. Other platform IDs and social
publication status are preserved. The video editor's YouTube logo button opens the detected
video, and remains disabled until a valid ID is known. Public HTML layouts can change or be
blocked by YouTube; unreadable pages pause the scan without discarding the cache.

Each version's first-publication date is an independent inclusive minimum (default
2026-10-01), not a way of selecting a version. Multiple active versions on the same channel
may use the same date and publish simultaneously. Channel accounts come from Settings.
The detector reconstructs the YouTube title using Publication templates for each project's
format and Bible language. It uses the title section (`Title`/`Título`, regardless of section
order), or the first nonempty line of a template without headings. Values match generation:
visual series title, Bible reference (including full chapters and cross-book passages), episode,
version name, and passage URL. Title placeholders requiring verse text (`passage`, `hashtags`)
are not guessed; an empty or unusable title template asks the editor to review the template
without downloading YouTube catalogs. The detector compares the entire normalized title;
there is no legacy pipe-prefix or raw project-title fallback for valid Bible passages.
Missing templates do not revert to broad title heuristics. Pending scan fingerprints include
rendered titles so template changes apply immediately. Only unique candidates are associated;
a video matching multiple pending projects, including across versions, remains ambiguous.

Existing project IDs and links already in bible-data are preserved by detection.
Ambiguous matches remain undetected rather than selecting an arbitrary video. The legacy Python script remains available but should
not be used for this workflow.

## Production setup and bootstrap

These are configuration/deployment steps; implementing this feature does not execute them:

1. Apply both remote migrations using the existing frontend and dashboard migration scripts.
2. Set `SITE_EXPORT_TOKEN` as a frontend Worker secret. Set the same value as a **secret build
   variable** for the frontend Workers Builds pipeline. Never use a `NEXT_PUBLIC_` variable.
3. Bootstrap the frontend Worker once with `SITE_ALLOW_EMPTY=1 pnpm --dir apps/frontend deploy`.
   This installs the internal entrypoint/export endpoint with empty new sections. Use this
   flag only for bootstrap; do not leave it configured in Workers Builds.
4. Deploy the dashboard with its existing production deployment command, after the frontend
   entrypoint exists. Its production service binding is declared explicitly.
5. Configure the site deploy hook in `/deployments`. Configure existing
   `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` dashboard secrets for build status tracking.
   Build failure/cancellation tracking is necessary to release a failed publication lock;
   without it, the static release marker can confirm success only. A custom confirmation in
   `/deployments` permits manual recovery after verifying an untracked update has stopped.
   If tracking is configured, recovery verifies the failed/cancelled build before releasing it.
6. Configure the social accounts in Settings, run HTML-based detection, and review `/website`.
7. Review and publish the website from `/deployments`.

The frontend build command downloads the selected immutable release before invoking Next.js.
`SITE_CONTENT_URL` can override the export URL; the production default is
`https://veobible.com/api/site-export`. A missing release or failed export stops a normal
build, preventing an accidental deployment with missing content. `SITE_CONTENT_FILE`
accepts a local snapshot for offline build/testing.

## Publication consistency and output

Publication validates every included project, including its YouTube ID, supported version,
passage boundaries, canonical address, and day 1–365 for long videos. Missing links block
publication until corrected or excluded. The review's content hash must still match when
publishing, avoiding silently including edits made after review.

An atomic frontend D1 claim permits one deployment at a time and assigns a unique release
revision. Subsequent website edits remain in the dashboard until the next explicit build. A rejected hook releases the claim;
a request with an uncertain result stays pending until reconciled. Existing build tracking
releases failed/cancelled updates. Successful builds are also reconciled using the deployed
`website-release.json` marker. Deployments launched outside the dashboard should not run
concurrently with editorial deployments; the dashboard lock cannot coordinate external CI.

The deployed snapshot is retained for comparison and rollback history. A failed publication
restores the export pointer to the previously deployed snapshot. Current snapshots fit in a
single D1 row; the write limit is deliberately capped at 1.8 MB. Split snapshot storage if
future editorial volume exceeds that limit. Cross-database writes and external build triggers
are not a distributed transaction; deployment records and revision matching support retries.

Pages use static HTML, Bible text from repository JSON, canonical metadata, section listings,
related navigation, and a click-to-play YouTube privacy-enhanced embed. Section titles and
routes are localized for English, Spanish and Portuguese. Reader chapter routes stay noindex.
Only actual publication pages appear in the sitemap. Excluding/unpublishing a project removes
its page on the next successful deployment.

Book videos are applied to the exported `out/bible-data/*/*/index.json` files before computing
the offline content manifest. The repository's source Bible JSON remains unchanged. Serving
these pages and Bible files does not require a D1 query per visitor.

Next.js 14 static export rejects a dynamic route with no parameters. The build uses a 404-only
placeholder when there are no publications and removes its output after export. It is never
listed in the sitemap.

## Verification

Frontend tests cover validation, export authorization, immutable snapshots and deployment
locking. Dashboard tests cover social publication scope, exclusions, matching, version minimum-date
boundaries and change summaries. Build both an empty site (`SITE_ALLOW_EMPTY=1`) and a populated
fixture (`SITE_CONTENT_FILE=tests/fixtures/website.json` when building inside apps/frontend). `WEBSITE_FIXTURE=1` enables the publication browser test in
`tests/e2e/website.spec.ts`; `PLAYWRIGHT_BASE_URL` selects its local preview server. Existing
reader/offline tests remain available.
