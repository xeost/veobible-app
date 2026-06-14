# VeoBible — Backend Design

## 1. Overview

The VeoBible backend is a lightweight REST API that enables cross-device synchronization of user data (bookmarks, reading position, ribbon, preferences). It runs on **Cloudflare Workers** with **Hono** as the web framework and **D1** (Cloudflare's edge SQLite) as the database.

Authentication is handled by **Supabase Auth** — the backend only verifies JWTs; it does not manage credentials directly.

The backend is **optional** — the frontend works fully without it (local-only mode). When authenticated, user data syncs transparently in the background.

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Cloudflare Workers (V8 isolates, edge-deployed) |
| Framework | Hono (lightweight, Workers-native) |
| Database | Cloudflare D1 (SQLite at the edge) |
| Auth | Supabase Auth (JWT verification only) |
| Deployment | Wrangler CLI → Cloudflare |

---

## 3. Architecture

```
┌──────────────────────────────────────────────┐
│               Cloudflare Edge                │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │         Hono Application               │  │
│  │                                        │  │
│  │  middleware/auth.ts  ← JWT verify      │  │
│  │  routes/bookmarks.ts                   │  │
│  │  routes/folders.ts                     │  │
│  │  routes/reading.ts                     │  │
│  │  routes/preferences.ts                 │  │
│  │  routes/sync.ts                        │  │
│  └───────────────┬────────────────────────┘  │
│                  │                           │
│  ┌───────────────▼────────────────────────┐  │
│  │           Cloudflare D1                │  │
│  │     (SQLite — edge-replicated)         │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
         ▲
         │  HTTPS + Bearer JWT
         │
┌────────┴──────────┐
│  VeoBible PWA     │
│  (static, any CDN)│
└───────────────────┘
```

---

## 4. Authentication

### 4.1 Flow

1. User signs in via Supabase Auth in the frontend (email, Google, or Apple)
2. Frontend receives a Supabase JWT access token
3. All API requests include: `Authorization: Bearer <supabase_jwt>`
4. The Worker verifies the JWT signature using Supabase's JWKS (cached)
5. Extracts `sub` claim as `userId`

### 4.2 Middleware

```typescript
// middleware/auth.ts
import { createMiddleware } from 'hono/factory'
import { verify } from 'hono/jwt'

export const authMiddleware = createMiddleware(async (c, next) => {
  const header = c.req.header('Authorization')
  if (!header?.startsWith('Bearer ')) {
    return c.json({ error: 'unauthorized' }, 401)
  }
  const token = header.slice(7)
  try {
    const payload = await verify(token, c.env.SUPABASE_JWT_SECRET)
    c.set('userId', payload.sub as string)
  } catch {
    return c.json({ error: 'invalidToken' }, 401)
  }
  await next()
})
```

### 4.3 Environment Variables

| Variable | Description |
|----------|-------------|
| `SUPABASE_JWT_SECRET` | Supabase project JWT secret (for HS256 verification) |
| `SUPABASE_URL` | Supabase project URL (for optional admin calls) |

---

## 5. Database Schema (D1)

```sql
-- Users table (minimal — auth is in Supabase)
CREATE TABLE users (
  id TEXT PRIMARY KEY,           -- Supabase Auth user ID (UUID)
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Bookmarks
CREATE TABLE bookmarks (
  id TEXT PRIMARY KEY,           -- UUID v4 (generated client-side)
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  versionSlug TEXT NOT NULL,
  bookSlug TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  verseStart INTEGER NOT NULL,
  verseEnd INTEGER NOT NULL,
  selectedText TEXT NOT NULL,
  title TEXT,
  note TEXT,
  folderId TEXT REFERENCES bookmark_folders(id) ON DELETE SET NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT,                -- Soft delete for sync
  UNIQUE(userId, id)
);

CREATE INDEX idx_bookmarks_user_version ON bookmarks(userId, versionSlug);
CREATE INDEX idx_bookmarks_user_updated ON bookmarks(userId, updatedAt);

-- Bookmark Folders
CREATE TABLE bookmark_folders (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  versionSlug TEXT NOT NULL,
  bookSlug TEXT NOT NULL,
  name TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT,
  UNIQUE(userId, id)
);

CREATE INDEX idx_folders_user_version ON bookmark_folders(userId, versionSlug);

-- Reading Positions (one per user per version)
CREATE TABLE reading_positions (
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  versionSlug TEXT NOT NULL,
  bookSlug TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  verseIndex INTEGER,
  updatedAt TEXT NOT NULL,
  PRIMARY KEY (userId, versionSlug)
);

-- Reading Ribbons (one per user per version)
CREATE TABLE reading_ribbons (
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  versionSlug TEXT NOT NULL,
  bookSlug TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  updatedAt TEXT NOT NULL,
  PRIMARY KEY (userId, versionSlug)
);

-- User Preferences (key-value per user)
-- Only syncable keys are stored: locale, theme, lastVersionSlug, readerFontFamily
-- Device-dependent keys (readerFontSize, readerLineHeight, readerContentWidth)
-- remain in localStorage only.
CREATE TABLE user_preferences (
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL CHECK (key IN ('locale', 'theme', 'lastVersionSlug', 'readerFontFamily')),
  value TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  PRIMARY KEY (userId, key)
);
```

---

## 6. API Design Principles

- **RESTful**: resources as nouns, HTTP verbs for actions
- **JSON**: all request/response bodies are JSON
- **lowerCamelCase**: all field names use lowerCamelCase
- **Timestamps**: ISO 8601 strings (UTC)
- **IDs**: UUID v4, generated client-side (enables offline creation)
- **Soft deletes**: `deletedAt` field for sync-aware deletion
- **Pagination**: cursor-based where needed
- **Idempotent writes**: PUT for upserts, client-generated IDs prevent duplicates

---

## 7. API Routes

### Base URL

```
https://api.veobible.com/v1
```

### Route Overview

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check (unauthenticated) |
| GET | `/bookmarks` | List user's bookmarks |
| POST | `/bookmarks` | Create a bookmark |
| PATCH | `/bookmarks/:id` | Update a bookmark |
| DELETE | `/bookmarks/:id` | Soft-delete a bookmark |
| GET | `/bookmarks/folders` | List user's bookmark folders |
| POST | `/bookmarks/folders` | Create a folder |
| PATCH | `/bookmarks/folders/:id` | Update a folder |
| DELETE | `/bookmarks/folders/:id` | Soft-delete a folder |
| GET | `/reading/positions` | List all reading positions |
| PUT | `/reading/positions/:versionSlug` | Upsert reading position |
| GET | `/reading/ribbons` | List all ribbons |
| PUT | `/reading/ribbons/:versionSlug` | Upsert ribbon |
| DELETE | `/reading/ribbons/:versionSlug` | Delete ribbon |
| GET | `/preferences` | Get all preferences |
| PUT | `/preferences` | Batch upsert preferences |
| GET | `/sync` | Pull changes since timestamp |
| POST | `/sync` | Push batch of local changes |

---

## 8. Sync Protocol

### 8.1 Design Goals

- **Offline-first**: client mutates locally, then syncs when online
- **Incremental**: only transfer changes since last sync
- **Idempotent**: re-sending the same push has no side effects
- **Conflict resolution**: last-write-wins via `updatedAt`

### 8.2 Pull

```
GET /v1/sync?since=2024-01-01T00:00:00Z
```

Returns all records modified after `since` across all resource types:

```json
{
  "bookmarks": [...],
  "bookmarkFolders": [...],
  "readingPositions": [...],
  "readingRibbons": [...],
  "preferences": [...],
  "serverTime": "2024-06-14T12:00:00Z"
}
```

The client stores `serverTime` and uses it for the next pull.

### 8.3 Push

```
POST /v1/sync
```

Body contains all locally-modified records:

```json
{
  "bookmarks": [
    { "id": "...", "versionSlug": "kjv", ..., "updatedAt": "..." },
    { "id": "...", "deletedAt": "..." }
  ],
  "bookmarkFolders": [...],
  "readingPositions": [...],
  "readingRibbons": [...],
  "preferences": [...]
}
```

Server applies each change using last-write-wins:
- If server's `updatedAt` > client's `updatedAt` → reject (return server version)
- Otherwise → apply client's version

Response includes any conflicts:

```json
{
  "applied": 15,
  "conflicts": [
    { "type": "bookmark", "id": "...", "serverVersion": {...} }
  ],
  "serverTime": "2024-06-14T12:00:01Z"
}
```

### 8.4 Initial Sync (First Login)

When a user logs in for the first time (no server data exists):
1. Client pushes all local data via `POST /sync`
2. Server creates user record + inserts all data
3. Client marks all records as `syncStatus: 'synced'`

### 8.5 Merge (Existing User, New Device)

When a user logs in on a new device:
1. Client calls `GET /sync?since=1970-01-01T00:00:00Z` (full pull)
2. Client merges server data with any existing local data (last-write-wins)
3. Client pushes any local-only changes via push

---

## 9. Error Handling

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 204 | No Content (successful delete) |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (missing/invalid token) |
| 404 | Not Found |
| 409 | Conflict (sync conflict detail in body) |
| 429 | Rate Limited |
| 500 | Internal Server Error |

### Error Response Format

```json
{
  "error": "validationFailed",
  "message": "Field 'chapter' must be a positive integer",
  "details": [
    { "field": "chapter", "issue": "mustBePositiveInteger" }
  ]
}
```

---

## 10. Rate Limiting

Implemented via Cloudflare's built-in rate limiting or a simple D1-backed counter:

| Endpoint | Limit |
|----------|-------|
| All authenticated | 100 req/min per user |
| `POST /sync` | 10 req/min per user |
| `GET /health` | 60 req/min per IP |
| Other unauthenticated | Rejected (401) |

---

## 11. Project Structure

```
backend/
├── src/
│   ├── index.ts              # Hono app entry, route registration
│   ├── middleware/
│   │   ├── auth.ts           # JWT verification middleware
│   │   └── error.ts          # Global error handler
│   ├── routes/
│   │   ├── bookmarks.ts      # /bookmarks CRUD
│   │   ├── folders.ts        # /bookmarks/folders CRUD
│   │   ├── reading.ts        # /reading/positions & ribbons
│   │   ├── preferences.ts    # /preferences
│   │   └── sync.ts           # /sync/pull & push
│   ├── db/
│   │   ├── schema.sql        # D1 table definitions
│   │   └── queries.ts        # Typed query helpers
│   ├── types/
│   │   └── index.ts          # Shared types (mirrors frontend models)
│   └── utils/
│       ├── validation.ts     # Request body validation
│       └── timestamps.ts     # ISO 8601 helpers
├── wrangler.toml             # Workers config (D1 binding, env vars)
├── package.json
└── tsconfig.json
```

---

## 12. Wrangler Configuration

```toml
name = "veobible-api"
main = "src/index.ts"
compatibility_date = "2024-06-01"

[vars]
ENVIRONMENT = "production"

[[d1_databases]]
binding = "DB"
database_name = "veobible-prod"
database_id = "<d1-database-id>"

# Secrets (set via `wrangler secret put`):
# - SUPABASE_JWT_SECRET
# - SUPABASE_URL
```

---

## 13. Deployment

| Command | Action |
|---------|--------|
| `wrangler dev` | Local development with D1 |
| `wrangler d1 migrations apply veobible-prod --local` | Apply pending migrations locally |
| `wrangler d1 migrations apply veobible-prod` | Apply pending migrations to production |
| `wrangler d1 migrations create veobible-prod <name>` | Create a new numbered migration file |
| `wrangler deploy` | Deploy Worker to Cloudflare |

### Migration workflow

Migration SQL files live in `migrations/` and are numbered sequentially (`0001_initial_schema.sql`, `0002_name.sql`, …). Wrangler tracks applied migrations in a `d1_migrations` table in D1.

Migrations are **not** applied automatically on `wrangler deploy`. The recommended CI/CD order is:

```
1. wrangler d1 migrations apply veobible-prod   # schema changes first
2. wrangler deploy                               # then deploy new code
```

---

## 14. Security Considerations

- **No CORS wildcards**: only allow `https://veobible.com` origin
- **JWT verification**: every request validated; no session cookies on the API
- **Input validation**: all request bodies validated with strict schemas
- **SQL injection**: D1 prepared statements with bound parameters only
- **Soft deletes**: data is never physically deleted (audit trail + undo)
- **Rate limiting**: prevents abuse from compromised tokens
- **No PII beyond email**: Supabase stores auth details; D1 only stores user UUID
