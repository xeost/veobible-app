<div align="center">

<img src="material/favicon-for-app/icon1.png" alt="VeoBible" width="96" height="96" />

# VeoBible

**A modern Bible reading app — clean, fast, and installable.**

Read the King James Version and Reina Valera 1909 across English and Spanish interfaces, with bookmarks, per-version reading sessions, and full offline support via PWA.

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js&logoColor=white)](https://nextjs.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-38bdf8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![PWA](https://img.shields.io/badge/PWA-ready-5a0fc8?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)

</div>

---

## ✨ Features

| Feature | Details |
|---------|---------|
| 📖 **Multiple Bible versions** | KJV (English) and Reina Valera 1909 (Spanish) |
| 🌐 **Bilingual UI** | Interface language (EN/ES) is independent of the Bible version selected |
| 🔖 **Text bookmarks** | Select any passage → floating toolbar → saved instantly |
| 📌 **Reading sessions** | Position is saved per-version and restored on return |
| 🌙 **Light / Dark / System theme** | Smooth transitions, warm amber accent palette |
| 📱 **PWA** | Installable from browser, works offline |
| ⚡ **Static generation** | All 2,386 chapter pages are pre-rendered at build time |
| 🔍 **SEO-optimized** | Title, description, Open Graph, canonical URL, and JSON-LD breadcrumbs on every chapter |
| 🔄 **Sync-ready architecture** | Local storage today — designed for remote sync without refactoring |

---

## 🗂 Project Structure

```
src/
├── app/
│   ├── page.tsx                        # / → auto-detects locale, redirects
│   └── [lang]/
│       ├── page.tsx                    # /en  /es — version selection homepage
│       └── [version]/
│           ├── page.tsx                # /en/kjv — book list
│           └── [book]/[chapter]/
│               └── page.tsx            # /en/kjv/genesis/1 — chapter reader (SSG)
├── components/
│   ├── ui/          # Toast, Sheet, Dropdown
│   ├── layout/      # Header, Sidebar
│   ├── reader/      # ChapterReader, VerseItem, SelectionToolbar
│   └── bookmarks/   # BookmarksList, BookmarkCard
├── hooks/
│   ├── useBookmarks.ts        # Optimistic add/remove
│   ├── useReadingPosition.ts  # Debounced scroll-position persistence
│   └── useTextSelection.ts    # DOM selection → verse range detection
└── lib/
    ├── bible/     # types, config (version registry), loader (build-time)
    ├── storage/   # StorageRepository interface + LocalStorageAdapter
    └── i18n/      # EN/ES translations, React context, server getter
```

---

## 🚀 Getting Started

**Prerequisites:** Node.js 18+, pnpm

```bash
# Install dependencies
pnpm install

# Start the development server
pnpm dev
```

Then open [http://localhost:3000](http://localhost:3000).

### Environment variables

Copy [`.env.example`](.env.example) to `.env.local` and adjust as needed:

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_READER_RECOMMENDED_CONTENT` | *(disabled)* | Set to `true` to show the **Recommended Content** section below verses in the chapter reader. |

> `NEXT_PUBLIC_*` variables are inlined at build time. Restart the dev server (or rebuild for production) after changing them.

```bash
# Production build (generates all 2,386 static pages)
pnpm build

# Serve production build
pnpm start
```

---

## 🌐 URL Structure

```
/                               → redirect to /en or /es (locale detection)
/en                             → English homepage
/es                             → Spanish homepage
/en/kjv                         → KJV book list
/es/rv1909                     → Reina Valera 1909 book list
/en/kjv/genesis/1               → Genesis chapter 1 (KJV)
/es/rv1909/genesis/1           → Génesis capítulo 1 (rv1909)
```

> Note: Spanish book slugs follow the rv1909 index (e.g. `exodo`, `levitico`, `1-reyes`).

---

## 🔖 Bookmarks & Reading Position

User data is stored in the browser via `localStorage`. The storage layer uses a **repository pattern** designed for future remote sync:

```
StorageRepository (interface)
    └── LocalStorageAdapter   ← active today
    └── RemoteAdapter         ← swap here when adding sync
```

All methods are `async` / `Promise`-based. The `useBookmarks` hook uses **optimistic UI**: the bookmark appears in the list immediately and rolls back silently if the write fails. No UI changes are needed when a remote adapter is introduced.

---

## 📦 Bible Data

JSON files live under `material/bible-versions/`:

```
material/bible-versions/
├── en/kjv/
│   ├── index.json              # Version metadata + book list
│   └── genesis/
│       ├── 1.json              # Array of { verse, text }
│       └── ...
└── es/rv1909/
    ├── index.json
    └── genesis/
        └── 1.json
```

At build time, chapters are read by [`src/lib/bible/loader.ts`](src/lib/bible/loader.ts) via Node `fs`. At runtime, the same files are also served from `public/bible-data/` for future SPA / mobile dynamic loading.

---

## 🎨 Design System

The UI uses **CSS custom properties** for all semantic colors, making the theme switch instantaneous without JavaScript re-renders.

| Token | Light | Dark |
|-------|-------|------|
| `--bg-page` | `#f8f8fc` | `#0f0e17` |
| `--bg-card` | `#ffffff` | `#1a1828` |
| `--brand` | Violet 500 (`#8b5cf6`) | Violet 400 (`#a78bfa`) |
| `--reader-bg` | `#fafafa` | `#120f1e` |

**Fonts:**

- **Inter** — UI elements, navigation, labels
- **Lora** (serif) — Bible body text for comfortable long-form reading

---

## 📱 PWA & Offline Support

The app is installable from any modern browser. The service worker is generated automatically by [`next-pwa`](https://github.com/shadowwalker/next-pwa) during `pnpm build`.

### Caching architecture

| Cache | Strategy | Contents |
|-------|----------|----------|
| Precache (Workbox) | Instant (no network) | All 2,525 HTML pages, JS chunks, CSS, fonts |
| `pages` | `StaleWhileRevalidate` | Same-origin navigation requests |
| `veobible-bible-data` | `CacheFirst` (1 year) | Bible JSON files downloaded for offline reading |
| `static-js-assets` | `StaleWhileRevalidate` | JS chunks |
| `static-style-assets` | `StaleWhileRevalidate` | CSS |
| `google-fonts-webfonts` | `CacheFirst` (1 year) | Font files |

When a page is not found in any cache and there is no network, the SW serves **`/offline`** — a self-contained fallback page that auto-reloads when connectivity is restored.

### ⚠️ The service worker is disabled in development

`next-pwa` sets `disable: true` when `NODE_ENV === 'development'`, so **`pnpm dev` cannot be used to test offline behaviour**. You must build and serve the static export instead.

### Testing offline — step by step

**1. Build and serve the static export**

```bash
pnpm build
npx serve out/ -p 3000
```

**2. Open Chrome and register the service worker**

Open [http://localhost:3000](http://localhost:3000) in Chrome. Wait a few seconds for the SW to install. You can confirm it is active in:

> DevTools → Application → Service Workers → check that `/sw.js` shows **"activated and is running"**

**3. Go offline**

> DevTools → Network tab → throttle dropdown → **Offline**

Or simply disconnect your machine from the internet.

**4. What to verify**

| Test | Expected result |
| ------ | ---------------- |
| Navigate to `/en` or `/es` | Homepage loads instantly from cache |
| Navigate to `/en/kjv/genesis/1` | Chapter loads with full text |
| Navigate between chapters (Prev / Next) | Instant navigation, no network needed |
| Navigate to a URL that was never visited | The `/offline` fallback page is shown |
| Reconnect to the internet | The `/offline` page auto-reloads |

**5. Testing the offline Bible download**

With the network online, open any chapter, then click the **cloud icon** in the reader header to download a version for offline use. After the download completes, go offline and try reading chapters from that version — they will be served from `veobible-bible-data` cache.

**6. Inspecting caches**

> DevTools → Application → Cache Storage

You should see entries for `workbox-precache-*`, `pages`, `veobible-bible-data`, `static-js-assets`, etc.

### Installing as a PWA

After the SW is registered, Chrome/Edge will show an install prompt in the address bar. On mobile, use **Share → Add to Home Screen** (iOS Safari) or the browser menu (Android Chrome). Once installed, the app launches in standalone mode and works fully offline.

---

## 🔍 SEO

Every chapter page generates:

- `<title>` — e.g. *Genesis 1 - KJV | VeoBible*
- `<meta name="description">` — first verse of the chapter
- Open Graph (`og:title`, `og:description`, `og:url`)
- `<link rel="canonical">`
- JSON-LD `BreadcrumbList`
- `<html lang="...">` set per locale

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 14](https://nextjs.org) (App Router, SSG) |
| Styling | [Tailwind CSS v3](https://tailwindcss.com) + CSS custom properties |
| Language | TypeScript 5 |
| Fonts | Google Fonts (Inter, Lora) |
| Theming | [next-themes](https://github.com/pacocoursey/next-themes) |
| PWA | [next-pwa](https://github.com/shadowwalker/next-pwa) |
| Package manager | [pnpm](https://pnpm.io) |

---

## 📄 Bible Version Licensing

| Version | Language | Copyright |
|---------|----------|-----------|
| King James Version (KJV) | English | Public Domain (Crown Copyright in the UK) |
| Reina Valera 1909 (rv1909) | Spanish | Public Domain |

---

<div align="center">

Made with ✦ and a lot of coffee.

</div>
