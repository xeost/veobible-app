# VeoBible

> A Progressive Web App for reading the Bible — statically generated, fully offline-capable, and deployable to the edge.

**Production:** [veobible.com](https://veobible.com)

---

## Repository Structure

This is a monorepo with two independent packages and shared design documentation.

```
veobible-app/
├── frontend/    # Next.js PWA — static site, offline reader, i18n
├── backend/     # Cloudflare Workers API — sync, bookmarks, preferences
└── design/      # Architecture and API design documents
```

---

## Frontend

A Next.js 14 PWA with full static export (`output: 'export'`), deployed to **Cloudflare Pages**.

**Key features:**
- Multi-version, multi-language Bible reader (English & Spanish)
- ~2,400 statically generated chapter pages for optimal SEO
- Offline reading via Service Worker + Cache API (user-selected versions)
- Bookmarks with folders, reading ribbon, auto-saved reading position
- Typography customization (font family, size, line height, content width)
- Light / dark / system theme
- Optimistic UI + TanStack Query (planned, for cloud sync)
- Optional Supabase authentication (planned)

**Stack:** Next.js · TypeScript · Tailwind CSS · next-pwa (Workbox) · Cloudflare Pages

```bash
cd frontend
pnpm install
pnpm dev          # local dev server
pnpm build        # static export → out/
pnpm prod-preview # build + serve via wrangler pages dev
```

See [`frontend/`](./frontend) and [`design/frontend-design.md`](./design/frontend-design.md).

---

## Backend

A lightweight REST API for cross-device synchronization of user data, deployed to **Cloudflare Workers**.

**Key features:**
- Bookmarks & bookmark folders (soft-delete for sync)
- Reading positions & ribbons per Bible version
- Syncable user preferences
- Incremental sync with last-write-wins conflict resolution
- Optional — the frontend works fully without it
- Supabase JWT authentication (HS256)

**Stack:** Cloudflare Workers · Hono · D1 (SQLite) · Supabase Auth

```bash
cd backend
pnpm install
pnpm dev          # local dev with wrangler
pnpm deploy       # deploy to Cloudflare Workers
```

See [`backend/README.md`](./backend/README.md) for full setup and configuration instructions.

---

## Design Documents

| Document | Description |
|----------|-------------|
| [`design/frontend-design.md`](./design/frontend-design.md) | Frontend architecture, routing, data models, PWA strategy, planned cloud sync |
| [`design/backend-design.md`](./design/backend-design.md) | Backend architecture, D1 schema, API design, sync protocol |
| [`design/openapi.yml`](./design/openapi.yml) | OpenAPI 3.1.0 specification for the REST API |
