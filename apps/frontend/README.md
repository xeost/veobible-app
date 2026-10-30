# VeoBible frontend

Next.js exports the public home/version pages and localized reader shells. Chapter text stays in `public/bible-data`; no chapter HTML or RSC payload is generated.

## Routes and deployment

- `/es/leer/rv1909/genesis/1`, `/en/read/kjv/genesis/1`, `/pt/ler/arc/genesis/1`: interactive reader, `noindex` in initial HTML and HTTP headers.
- `/{language}/{version}`: indexable version presentation.
- Legacy chapter/book URLs redirect to the localized reader. The Worker validates book/chapter ranges before serving the static shell.
- `/api/v1/*`: Hono API with Supabase bearer authentication and the existing reader D1 database. JSON, fonts, scripts and public HTML are served directly by Workers Static Assets. Reader deep-link resolution and API calls invoke Worker code; moving between chapters inside the reader does not request HTML/RSC.

```sh
pnpm install
pnpm dev                      # Next development; localized deep links rewrite to shells
pnpm build                    # export, optimize images, generate hashes + offline shell
pnpm exec wrangler dev        # production preview, including API and deep-link routing
pnpm type-check
pnpm test                     # Node 22.15+ / 24+; includes SQLite-backed API tests
pnpm test:e2e                 # Chromium, with preview running on localhost:8790
```

For the full preview use `pnpm exec wrangler dev --port 8790`. For development with hot reload, run `pnpm dev:site` and `pnpm dev:api` from the repository root in separate terminals. Next proxies `/api/*` to the local API at `127.0.0.1:8787`, stripping the `/api` prefix. Reading and local saves work without the API; cross-device synchronization requires it. Production serves both from the frontend Worker.

The API implementation and D1 migrations live in `worker/api/` and `worker/migrations/`. `dev:api` runs `scripts/dev-api.mjs`, deriving an ignored API-only Wrangler config from `wrangler.jsonc`; it requires no Next.js build. Development API and full preview share `worker/.wrangler/state`, preserving the former backend's local database.

Initialize local D1 from the repository root:

```sh
pnpm --dir apps/frontend db:migrate:local
```

Copy `.dev.vars.example` to `.dev.vars` in `apps/frontend` for local Worker authentication settings. Production configuration and D1 bindings have a single source: `wrangler.jsonc`.

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for the frontend build, and the matching `SUPABASE_URL` for the Worker. HS256 projects also require the `SUPABASE_JWT_SECRET` Worker secret; ES256 uses Supabase JWKS. Local overrides belong in ignored `.env.local`/`.dev.vars`. Never combine a development Supabase project with production authentication settings.

`pnpm deploy` builds and deploys the single `veobible-app` Worker, including the reader API at `/api/v1`. Migrations are applied separately with `pnpm db:migrate` (remote) or `pnpm db:migrate:local`; creating a migration uses `pnpm db:migration:new <name>`. The existing production D1 database ID is preserved. There is no separate backend package or API Worker deployment.

## Offline content

The service worker precaches reader/home shells for all three languages, bundled JS/CSS/fonts and installation icons. Authenticated requests are never cached. Activation preserves Bible downloads and previous shell caches for open tabs. The update banner activates a waiting worker only when selected.

`build-offline.mjs` generates a SHA-256 manifest of the JSON corpus. Books are downloaded as one file, checked against the manifest, and persisted before completion is shown. Reads use memory/Cache Storage before the network. Legacy cache entries remain readable offline. Downloads resume by reusing cached books and request persistent browser storage where available. Browser eviction remains possible.

The reader uses native links and the History API for chapter changes, including bookmarks, search, back/forward and verse fragments. It has one online/offline rendering path.

## User data

IndexedDB holds account-scoped bookmarks, folders, reading positions, ribbons and preferences. Each local change and its pending operation are committed together. The outbox coalesces edits and retries on connection recovery, focus, periodic sync and manual sync. Acknowledgements remove only the operation that was sent, preserving edits made while the request was in flight.

Legacy localStorage data is imported once and retained as a backup. Guest data is transferred on an explicit sign-in; switching accounts never reimports another account's data. Sign-out defaults to preserving device data, with an explicit erase option. Note conflicts create a separate bookmark rather than discarding either note. Full server snapshots propagate hard-deleted ribbons and avoid timestamp cursor gaps; their cost grows with the user's saved data.

## Release verification

Run unit/API tests, type checks, production build and browser tests before deployment. Test real sign-in, token refresh and two-device synchronization with a staging Supabase account/D1 database. After release, verify legacy redirects and `noindex` in Search Console. Existing installed PWAs must accept the application update before using the new reader.

## Website content publication

Website content is exported by the dashboard to private R2 storage. Production builds fetch the immutable artifact assigned to `WORKERS_CI_BUILD_UUID` from `https://dash.veobible.com/api/site-export`, using the dedicated `SITE_EXPORT_TOKEN` build secret. That endpoint redirects to a five-minute presigned URL; the build downloads the snapshot directly from private R2 without forwarding the export credential. R2 S3 signing credentials stay exclusively in the dashboard. The frontend Worker has no access to dashboard data or publishing storage. Each deployed marker includes the content hash and deployment ID.

Development previews read the local dashboard on port 3003. Offline builds can explicitly set `SITE_CONTENT_FILE`; empty test builds can set `SITE_ALLOW_EMPTY=1`. Production updates must be initiated through the dashboard so each build is registered; unregistered builds stop rather than using potentially incorrect content.

See [publication architecture, retention and setup](../../docs/website-publishing.md).
