# VeoBible API

REST API for cross-device synchronization of user data (bookmarks, reading position, ribbon, preferences). Built on **Cloudflare Workers** + **Hono** + **D1 (SQLite at the edge)**.

Authentication is handled by **Supabase Auth** — the API only verifies JWTs and does not manage credentials directly. The backend is **optional**: the frontend works fully without it in local-only mode.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Cloudflare Workers (V8 isolates, edge-deployed) |
| Framework | Hono v4 |
| Database | Cloudflare D1 (SQLite) |
| Auth | Supabase Auth (JWT verification, HS256) |
| Deployment | Wrangler CLI |

---

## Project Structure

```
backend/
├── src/
│   ├── index.ts              # App entry: CORS, route registration, error handlers
│   ├── middleware/
│   │   ├── auth.ts           # Supabase JWT verification (HS256)
│   │   └── error.ts          # Global 404 / 500 handlers
│   ├── routes/
│   │   ├── health.ts         # GET /v1/health  (unauthenticated)
│   │   ├── bookmarks.ts      # /v1/bookmarks   CRUD
│   │   ├── folders.ts        # /v1/bookmarks/folders  CRUD
│   │   ├── reading.ts        # /v1/reading/positions & /ribbons
│   │   ├── preferences.ts    # /v1/preferences
│   │   └── sync.ts           # GET|POST /v1/sync  (pull / push)
│   ├── db/
│   │   ├── schema.sql        # D1 table definitions + indexes
│   │   └── queries.ts        # Typed query helpers (reused by routes and sync)
│   ├── types/
│   │   └── index.ts          # Cloudflare bindings, domain types, response shapes
│   └── utils/
│       ├── timestamps.ts     # now(), isValidISO()
│       └── validation.ts     # Request body validators
├── wrangler.toml             # Workers config (D1 binding, secrets declaration)
├── package.json
└── tsconfig.json
```

---

## API Reference

Base URL: `https://api.veobible.com/v1`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | No | Health check — returns API and DB status |
| `GET` | `/bookmarks` | Yes | List bookmarks (optional `?versionSlug=`) |
| `POST` | `/bookmarks` | Yes | Create bookmark |
| `PATCH` | `/bookmarks/:id` | Yes | Update bookmark title / note / folder |
| `DELETE` | `/bookmarks/:id` | Yes | Soft-delete bookmark |
| `GET` | `/bookmarks/folders` | Yes | List bookmark folders |
| `POST` | `/bookmarks/folders` | Yes | Create folder |
| `PATCH` | `/bookmarks/folders/:id` | Yes | Update folder name / order |
| `DELETE` | `/bookmarks/folders/:id` | Yes | Soft-delete folder (unassigns its bookmarks) |
| `GET` | `/reading/positions` | Yes | List reading positions (all versions) |
| `PUT` | `/reading/positions/:versionSlug` | Yes | Upsert reading position |
| `GET` | `/reading/ribbons` | Yes | List reading ribbons (all versions) |
| `PUT` | `/reading/ribbons/:versionSlug` | Yes | Upsert reading ribbon |
| `DELETE` | `/reading/ribbons/:versionSlug` | Yes | Delete reading ribbon |
| `GET` | `/preferences` | Yes | Get syncable user preferences |
| `PUT` | `/preferences` | Yes | Update syncable user preferences |
| `GET` | `/sync?since=<ISO8601>` | Yes | Pull all changes after timestamp |
| `POST` | `/sync` | Yes | Push local changes (last-write-wins, returns conflicts) |

See [`../design/openapi.yml`](../design/openapi.yml) for the full OpenAPI 3.1.0 specification.

### Authentication

All endpoints except `GET /health` require a **Supabase JWT** passed as a Bearer token:

```
Authorization: Bearer <supabase_access_token>
```

The token is verified locally using the project's JWT secret (no external network call to Supabase on each request).

### Sync Protocol

**Pull** — fetch all changes since a timestamp:
```
GET /v1/sync?since=2024-01-01T00:00:00Z
```

**Push** — send locally-modified records:
```json
POST /v1/sync
{
  "bookmarks": [...],
  "bookmarkFolders": [...],
  "readingPositions": [...],
  "readingRibbons": [...],
  "preferences": { "theme": "dark" }
}
```

Conflicts (server version is newer) are returned in the response — the client decides how to resolve them. All other records are applied.

---

## Database Migrations

Migrations live in `migrations/` as numbered SQL files (`0001_name.sql`, `0002_name.sql`, …). Wrangler tracks which ones have been applied via a `d1_migrations` table in D1.

### Creating a new migration

```bash
pnpm db:migration:new add_reading_goals
# creates migrations/0002_add_reading_goals.sql
```

Edit the generated file with your `ALTER TABLE` / `CREATE TABLE` statements, then apply:

```bash
pnpm db:migrate:local   # test locally first
pnpm db:migrate         # apply to production
```

### Migrations and deployment

Migrations are **not** applied automatically on `wrangler deploy`. Run them as an explicit step before deploying:

```bash
# In CI/CD pipeline (e.g. GitHub Actions):
pnpm db:migrate   # 1. apply schema changes (--remote → production D1)
pnpm deploy       # 2. deploy new Worker code
```

This separation ensures schema changes are always intentional and auditable.

---

## Setup

### Prerequisites

- [Node.js](https://nodejs.org) ≥ 18
- [pnpm](https://pnpm.io) ≥ 8
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (installed as a dev dependency)
- A [Cloudflare](https://cloudflare.com) account
- A [Supabase](https://supabase.com) project

### 1. Install dependencies

```bash
pnpm install
pnpm approve-builds --all   # approve native build scripts (esbuild, workerd)
```

### 2. Create the D1 database

```bash
npx wrangler d1 create veobible-prod
```

Copy the returned `database_id` into `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "veobible-prod"
database_id   = "<paste-here>"
```

### 3. Apply database migrations

```bash
pnpm db:migrate          # apply pending migrations to production (--remote)
pnpm db:migrate:local    # apply pending migrations to local dev DB
```

D1 tracks applied migrations in a `d1_migrations` table. Only pending (unapplied) migrations are executed on each run.

### 4. Set secrets

```bash
npx wrangler secret put SUPABASE_JWT_SECRET
# Paste the value from: Supabase Dashboard → Project Settings → API → JWT Secret
```

---

## Development

```bash
pnpm dev
```

Starts a local Workers dev server at `http://127.0.0.1:8787` with a local D1 SQLite file. Hot-reload is enabled.

### Type-check

```bash
pnpm type-check
```

---

## Deployment

Deployment is handled automatically via the **native Cloudflare Workers × GitHub integration**. Every push to `main` that includes changes under `backend/` triggers a new deploy.

### Cloudflare dashboard configuration

Connect the repository at **Cloudflare Dashboard → Workers & Pages → Create → Import a repository**, then set:

| Setting | Value |
|---------|-------|
| **Root directory** | `/backend` |
| **Build command** | `pnpm install` |
| **Deploy command** | `pnpm db:migrate && pnpm wrangler deploy` |

The deploy command applies any pending D1 migrations before deploying the new Worker code, ensuring the schema is always updated before the code that depends on it.

### Secrets

Secrets are configured in **Cloudflare Dashboard → Worker → Settings → Variables and Secrets** — never committed to the repository.

| Secret | Description |
|--------|-------------|
| `SUPABASE_JWT_SECRET` | Supabase project JWT secret (Settings → API → JWT Secret) |

---

## Preferences Sync Scope

Only device-independent preferences are stored in the cloud:

| Preference | Syncs |
|------------|-------|
| `locale` | ✅ |
| `theme` | ✅ |
| `lastVersionSlug` | ✅ |
| `readerFontFamily` | ✅ |
| `readerFontSize` | ❌ local-only |
| `readerLineHeight` | ❌ local-only |
| `readerContentWidth` | ❌ local-only |

Device-dependent settings remain in `localStorage` and are never sent to the API.
