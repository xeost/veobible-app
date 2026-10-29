# VeoBible

> A Progressive Web App for reading the Bible — statically generated, fully offline-capable, and deployable to the edge.

**Production:** [veobible.com](https://veobible.com)

---

## Repository Structure

The reader and dashboard are independent applications. The reader API is part of the frontend Worker.

```
veobible-app/
├── apps/
│   ├── frontend/         # Next.js PWA + veobible-app Worker
│   │   └── worker/
│   │       ├── api/      # Reader API: auth, bookmarks, sync
│   │       └── migrations/ # Reader D1 migrations
│   └── dashboard/        # Independent dashboard application
└── design/               # Architecture and API design documents
```

---

## Frontend

A Next.js 14 PWA with full static export (`output: 'export'`), deployed to **Cloudflare Workers**.

**Key features:**
- Multi-version, multi-language Bible reader (English & Spanish)
- Indexable version pages and client-side chapter reading with noindex
- Offline reading via Service Worker + Cache API (user-selected versions)
- Bookmarks with folders, reading ribbon, auto-saved reading position
- Typography customization (font family, size, line height, content width)
- Light / dark / system theme
- Optimistic UI with account-scoped IndexedDB and a durable sync outbox
- Optional Supabase authentication

**Stack:** Next.js · TypeScript · Tailwind CSS · Service Worker · Cloudflare Workers

```bash
cd apps/frontend
pnpm install
pnpm dev          # local dev server
pnpm build        # static export → out/
pnpm prod-preview # build + serve the combined Worker
```

See [`apps/frontend/`](./apps/frontend) and [`design/frontend-design.md`](./design/frontend-design.md).

---

## Reader API

The API lives in `apps/frontend/worker/api/` and is deployed with the frontend as **veobible-app**. Supabase Auth verifies identity and the existing D1 database stores bookmarks, reading positions, ribbons and preferences.

For local development, run these in separate terminals from the repository root:

```bash
pnpm dev:site       # Next.js on port 3000, proxies /api/*
pnpm dev:api    # API on port 8787, using the frontend package
```

Initialize local D1 with `pnpm --dir apps/frontend db:migrate:local`. Both the API development server and full Worker preview share `apps/frontend/worker/.wrangler/state`.

See [`apps/frontend/README.md`](./apps/frontend/README.md) for authentication, migrations and deployment.
---

## Design Documents

| Document | Description |
|----------|-------------|
| [`design/frontend-design.md`](./design/frontend-design.md) | Frontend architecture, routing, data models, PWA strategy, planned cloud sync |
| [`design/backend-design.md`](./design/backend-design.md) | Backend architecture, D1 schema, API design, sync protocol |
| [`design/openapi.yml`](./design/openapi.yml) | OpenAPI 3.1.0 specification for the REST API |

La publicación de videos en el sitio se administra desde `/website` y `/deployments`.
Consulta [la configuración y el flujo de publicación](design/website-publication.md).
