# Website publication bridge

The dashboard owns editorial data and publication coordination. The frontend runtime has no dashboard database binding, service binding, R2 binding, or export credential. Its build downloads a validated public-content artifact through the dashboard's narrowly scoped `/api/site-export` endpoint. That endpoint streams R2 content; it never exposes source tables or arbitrary database queries.

## Data and state

- `deployments` in the dashboard stores attempt IDs, content hashes, build IDs and status. A partial unique index permits only one active site publication. There is no separate `website_state` record to synchronize.
- A singleton table is a valid SQL design for genuinely global state. It was unnecessary here because active and successfully published revisions can be derived from deployment records. The latest successful attempt is selected by its monotonic ID.
- R2 stores `releases/<deployment-id>.json`. Each file contains only the validated public content, its deterministic SHA-256 hash and its independent deployment ID. The unique object key prevents cleanup racing with a later attempt that has the same content. Retries may temporarily duplicate content; retention bounds this duplication.
- Development overwrites one local R2 object, `development/content.json`, and does not create deployment history or production releases.
- The pre-production frontend migration `0002_website.sql` and publishing Worker entrypoint have been removed. Dashboard migration `0007_website_publication.sql` adds the indexes. Existing local databases that already ran the removed migration may still contain the two unused tables; preserve or remove those local test tables explicitly as needed. No remote migration or deletion is performed by this change.

## Publication flow

1. The dashboard validates the reviewed content and atomically reserves an active `deployments` row.
2. It writes the immutable R2 artifact and calls the saved Cloudflare deploy hook. An upload failure marks the attempt failed before any hook is called.
3. The hook's `build_uuid` is assigned to that attempt. A reused build (`already_exists`), missing identifier or transport timeout is treated as ambiguous; it is never assigned to a different snapshot.
4. The frontend build supplies Cloudflare's `WORKERS_CI_BUILD_UUID` to the export endpoint. The endpoint only serves the artifact associated with that active build. A short bounded retry handles the race where the build starts before the hook response is recorded. There is no mutable `latest` fallback.
5. The build checks the content hash and embeds both the revision and deployment ID in `website-release.json`. An older deployment of identical content cannot falsely confirm a new attempt.
6. A dashboard Cron Trigger runs every five minutes to reconcile provider build status, check the published marker and clean up. Opening deployment history and starting a publication also reconcile.

Unknown attempts stay reserved until confirmed or explicitly resolved after the build has stopped. They are not automatically unlocked by a timeout, since a delayed build could otherwise overwrite a newer publication. Without optional Workers Builds read credentials, the live marker confirms success; failed/ambiguous builds need manual resolution.

## Retention and capacity

Cleanup preserves the two latest successful attempts, any active attempt, and the one development object. Unreferenced production objects are deleted once their upload is at least one hour old. The grace period protects in-flight uploads, and paginated listing also finds orphaned files after a crash. Failed deletes are retried on the next run. Short bursts can temporarily leave additional files during that hour; old versions do not accumulate indefinitely.

D1 keeps the latest 200 site attempts plus any older retained successes or active attempt. Content never occupies a D1 row. Release files have an explicit 32 MiB safety ceiling to bound validation/serialization memory in the Worker, instead of D1's 2 MB row limit. The existing contract also limits publication counts. R2 removes the database-row bottleneck; catalogs beyond this ceiling should move to partitioned manifests/streaming validation, and static generation time must be measured separately. No claim of unlimited build scalability is made.

## Setup before deployment

1. Create a private R2 bucket named `veobible-website-content` in the dashboard account and verify the `WEBSITE_CONTENT` binding in both Wrangler environments. Do not enable public bucket access. Local development uses Wrangler's local R2 emulator.
2. Apply dashboard migrations, including `0007_website_publication.sql`.
3. Set an independent secret of at least 32 random bytes as `SITE_EXPORT_TOKEN` on the dashboard and as a **build secret only** on the frontend. Manual dashboard deployment/GitHub Actions accepts `DASHBOARD_SITE_EXPORT_TOKEN` and uploads it under the runtime name. This is not a reader authentication or dashboard session secret.
4. Keep the frontend build command `pnpm build` and use `pnpm exec wrangler deploy` as the deploy command, avoiding a second build. Set `SITE_CONTENT_URL=https://dash.veobible.com/api/site-export` if overriding the default.
5. Create/save the site's Cloudflare deploy hook in the dashboard. Publish through the dashboard, including code-only updates, so every production build has a registered content artifact. Disable independent automatic production build triggers. Unregistered builds fail closed; rerunning a completed provider build is not a new publication—start a new attempt in the dashboard.
6. Deploy the dashboard with its production Cron Trigger. Optionally configure the separate `DASHBOARD_PUBLISH_API_TOKEN` with Workers Builds read access for automatic failure reconciliation. Confirm the private export returns 401 without its dedicated credential.

Provisioning the bucket, setting real secrets, applying remote migrations and deploying remain operational setup steps; this repository change does not execute them.

## Local development and explicit offline builds

Run the dashboard on port 3003, apply its local migrations, and use its existing “Update preview” action. The frontend's development watcher reads `http://127.0.0.1:3003/api/site-export?development=1`; anonymous export is restricted to local mode and a loopback hostname. Development never writes production release objects.

For a reproducible offline build, set `SITE_CONTENT_FILE` to a validated snapshot with its content hash. `SITE_ALLOW_EMPTY=1` is reserved for explicit empty/test builds. Neither option is a fallback on network failure. Keep these overrides unset in the production build environment.

Cloudflare reference: [build identity environment variables](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/#default-variables), [deploy hook responses and idempotency](https://developers.cloudflare.com/workers/ci-cd/builds/deploy-hooks/).
