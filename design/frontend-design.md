# VeoBible — Frontend Design

## 1. Overview

VeoBible is a Progressive Web App (PWA) for reading the Bible. It is statically generated at build time for optimal SEO and deployed to Cloudflare Pages. The app works fully offline for downloaded Bible versions, supports multiple languages and versions, and provides a rich reading experience with bookmarks, typography customization, and reading progress tracking.

**Production URL:** `https://veobible.com`

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (`output: 'export'` — static site generation) |
| Language | TypeScript |
| Styling | Tailwind CSS + CSS custom properties |
| Theme | next-themes (light / dark / system) |
| Typography | 21 Google Fonts loaded via `next/font` with CSS variable injection |
| PWA | next-pwa (Workbox service worker) |
| Hosting | Cloudflare Pages (static assets) |
| Analytics | Google Analytics 4 |
| State (current) | React hooks (useState, useCallback, useEffect) |
| State (planned) | TanStack Query for server state, React hooks for UI state |
| Auth (planned) | Supabase Auth (optional — app works without login) |
| Sync (planned) | Optimistic UI via TanStack Query mutations + background sync |

---

## 3. Project Structure

```
src/
├── app/                      # Next.js App Router pages
│   ├── layout.tsx            # Root layout (fonts, theme, SW registration)
│   ├── page.tsx              # Root redirect → /[lang]
│   ├── sitemap.ts            # Dynamic sitemap for all chapters
│   ├── robots.ts             # Robots.txt
│   ├── offline/page.tsx      # Generic offline fallback page
│   └── [lang]/
│       ├── layout.tsx        # I18nProvider per language
│       ├── page.tsx          # Home page (version cards, verse of the day)
│       ├── offline-reader/   # Offline reader shell (SW document fallback)
│       └── [version]/
│           ├── page.tsx      # Version page (book list)
│           └── [book]/
│               └── (reader)/
│                   ├── layout.tsx          # Server: loads BibleIndex
│                   ├── ReaderLayoutClient.tsx  # Client: header, sidebars, state
│                   └── [chapter]/
│                       ├── page.tsx        # Server: SSG chapter, metadata
│                       └── ChapterClient.tsx   # Client: renders verses
├── components/
│   ├── bookmarks/            # BookmarkCard, BookmarksList, Folders, Modals
│   ├── layout/               # Headers, Sidebar, Logo, Theme/Language toggles
│   ├── reader/               # ChapterReader, BibleSearch, Settings, VerseItem
│   └── ui/                   # Dropdown, Sheet, Toast, Tooltip
├── hooks/
│   ├── useBookmarks.ts       # Bookmarks CRUD with optimistic updates
│   ├── useReadingRibbon.ts   # Manual reading marker per version
│   ├── useReadingPosition.ts # Auto-saved scroll position (debounced)
│   ├── useReaderPreferences.tsx  # Typography settings (font, size, width)
│   ├── useOfflineVersion.ts  # Download/delete Bible versions for offline
│   ├── useBibleIndex.ts      # Load bible index from cache
│   ├── useTextSelection.ts   # Verse selection for bookmarking
│   └── useTouchDrag.ts       # Touch gesture handling
├── lib/
│   ├── bible/
│   │   ├── config.ts         # Bible version registry
│   │   ├── types.ts          # VersionMetadata, BookInfo, Verse, ChapterData
│   │   ├── loader.ts         # Server-side data loading (fs.readFileSync)
│   │   ├── bibleDataCache.ts # Client-side two-level cache (memory + Cache API)
│   │   └── verses-of-the-day.ts
│   ├── i18n/                 # Lightweight i18n (en, es)
│   ├── storage/
│   │   ├── types.ts          # StorageRepository interface
│   │   ├── local-adapter.ts  # localStorage implementation
│   │   └── index.ts          # Adapter factory (singleton)
│   └── context/
│       └── ReaderContext.tsx  # Bookmark functions for reader components
├── data/                     # Static contextual data (Bible overview JSON)
└── styles/
    └── globals.css           # CSS custom properties, Tailwind base
```

---

## 4. Routing & SEO

All chapter pages are statically generated at build time via `generateStaticParams()`. This produces one HTML file per chapter per version per language (~2,378 pages).

### URL Schema

| Route | Purpose |
|-------|---------|
| `/` | Root redirect (detects locale) |
| `/[lang]` | Home page |
| `/[lang]/[version]` | Version page (table of contents) |
| `/[lang]/[version]/[book]/[chapter]` | Chapter reader |
| `/[lang]/offline-reader` | Offline reader shell (precached, `noindex`) |
| `/offline` | Generic offline fallback |

### SEO Assets

- **Sitemap** (`/sitemap.xml`): all static routes + all chapter URLs
- **Robots** (`/robots.txt`): allows all crawlers
- **Metadata**: per-page `<title>`, OpenGraph, canonical URLs, hreflang alternates
- **Structured HTML**: semantic headings, verse markup

---

## 5. Data Architecture

### 5.1 Bible Content (Static)

Bible data lives in `public/bible-data/[lang]/[version]/`:

| File | Content |
|------|---------|
| `index.json` | `BibleIndex` (metadata + books array with chapter counts) |
| `[bookId].json` | All chapters for one book: `Record<string, Verse[]>` |
| `[bookId]/[chapter].json` | Single chapter: `Verse[]` |

**Server-side** (build time): `loader.ts` reads files via `fs.readFileSync` for SSG.

**Client-side** (runtime): `bibleDataCache.ts` implements a two-level cache:
1. **In-memory Map** — instant within current session
2. **Cache API** (`veobible-bible-data`) — persisted across navigations

### 5.2 User Data (Local Storage — Current)

All user data is persisted in `localStorage` via the `StorageRepository` interface:

| Data | Key | Structure |
|------|-----|-----------|
| Bookmarks | `veobible_bookmarks` | `Bookmark[]` |
| Bookmark Folders | `veobible_bookmark_folders` | `BookmarkFolder[]` |
| Reading Positions | `veobible_reading_positions` | `Record<versionSlug, ReadingPosition>` |
| Reading Ribbons | `veobible_reading_ribbons` | `Record<versionSlug, RibbonPosition>` |
| Preferences | `veobible_preferences` | `UserPreferences` |

### 5.3 Data Models

```typescript
interface Bookmark {
  id: string                // UUID v4
  versionSlug: string
  bookSlug: string
  chapter: number
  verseStart: number
  verseEnd: number
  selectedText: string
  title?: string            // User-defined label
  note?: string             // Multi-line personal note
  folderId?: string         // Optional folder reference
  createdAt: string         // ISO 8601
  syncStatus?: 'local' | 'synced' | 'pending' | 'conflict'
  serverId?: string
  updatedAt?: string
}

interface BookmarkFolder {
  id: string
  versionSlug: string
  bookSlug: string          // Scoped to a single book
  name: string
  order: number
  createdAt: string
}

interface ReadingPosition {
  versionSlug: string
  bookSlug: string
  chapter: number
  verseIndex?: number
  updatedAt: string
}

interface RibbonPosition {
  versionSlug: string
  bookSlug: string
  chapter: number
  updatedAt: string
}

interface UserPreferences {
  locale?: string
  theme?: 'light' | 'dark' | 'system'
  lastVersionSlug?: string
  readerFontFamily?: ReaderFontFamily
  readerFontSize?: ReaderFontSize
  readerLineHeight?: ReaderLineHeight
  readerContentWidth?: ReaderContentWidth
}
```

---

## 6. PWA & Offline Strategy

### 6.1 Service Worker

Generated by `next-pwa` (Workbox). Registered manually in root layout.

| Strategy | Scope | Cache Name |
|----------|-------|-----------|
| Precache | App shell pages, icons, offline-reader | `workbox-precache` |
| CacheFirst | `/bible-data/**/*.json` | `veobible-bible-data` |
| StaleWhileRevalidate | Same-origin HTML pages | `pages` |
| StaleWhileRevalidate | Static assets (JS, CSS, images, fonts) | Various |
| NetworkFirst | API routes, start URL | `start-url`, `apis` |
| CacheFirst | Google Fonts (woff2) | `google-fonts-webfonts` |

### 6.2 Offline Fallback Hierarchy

When a navigation request fails (offline + not cached):
1. **Chapter URLs** (4+ path segments): serve `/[lang]/offline-reader` from precache
2. **All other pages**: serve `/offline` from precache

### 6.3 Offline Reader Shell

`/[lang]/offline-reader` is a precached client-side page that:
1. Reads `window.location.pathname` to identify the requested chapter
2. Loads `index.json` and chapter data from the `veobible-bible-data` Cache API
3. If data available → renders full `ReaderLayoutClient` + `ChapterClient`
4. If not → shows reader header + "version not available offline" message

### 6.4 User-Initiated Offline Download

Users can download entire Bible versions via `useOfflineVersion`:
- Downloads all 66 per-book JSON files + `index.json` concurrently (4 workers)
- Shows progress (books downloaded / total)
- Supports cancel and delete
- Status: `checking` → `not-cached` | `partial` | `available`

---

## 7. Internationalization

Lightweight custom i18n system (no heavy library):

- **Supported locales**: `en`, `es`
- **Translation files**: `src/lib/i18n/translations/{en,es}.ts`
- **Context**: `I18nProvider` wraps `[lang]/layout.tsx`
- **Client hook**: `useI18n()` → `{ locale, t }`
- **Server helper**: `getTranslations(locale)`

---

## 8. Reader Features

### 8.1 Typography

21 font families across 3 categories (serif, sans, script). Configurable:
- Font family
- Font size (xs → 2xl)
- Line height (tight → loose)
- Content width (full → very-thin)

Applied via CSS custom properties on `<html>`. Persisted in `UserPreferences`.

### 8.2 Bookmarks

- Select verse range → create bookmark with selected text
- Optional title and multi-line notes
- Organized in folders (per book per version)
- Drag-and-drop between folders
- Optimistic UI for all operations

### 8.3 Reading Ribbon

Manual "where I left off" marker — one per Bible version. Shown in header bar.

### 8.4 Reading Position

Auto-saved scroll position (debounced 500ms). Used by the home page "Continue Reading" card.

### 8.5 Bible Search

Client-side full-text search across all chapters of the active version. Uses `fetchBook()` to load per-book data on demand (or from cache if offline-downloaded).

---

## 9. Storage Abstraction

The `StorageRepository` interface decouples all data access from the storage backend:

```typescript
interface StorageRepository {
  // Bookmarks
  getBookmarks(): Promise<Bookmark[]>
  getBookmarksByVersion(versionSlug: string): Promise<Bookmark[]>
  getBookmark(id: string): Promise<Bookmark | null>
  addBookmark(data: ...): Promise<Bookmark>
  updateBookmark(id: string, patch: ...): Promise<Bookmark>
  removeBookmark(id: string): Promise<void>
  clearBookmarks(): Promise<void>

  // Bookmark Folders
  getFoldersByVersion(versionSlug: string): Promise<BookmarkFolder[]>
  addFolder(data: ...): Promise<BookmarkFolder>
  updateFolder(id: string, patch: ...): Promise<BookmarkFolder>
  removeFolder(id: string): Promise<void>

  // Reading Position
  getReadingPosition(versionSlug: string): Promise<ReadingPosition | null>
  setReadingPosition(position: ReadingPosition): Promise<void>

  // Reading Ribbon
  getRibbonPosition(versionSlug: string): Promise<RibbonPosition | null>
  setRibbonPosition(position: RibbonPosition): Promise<void>
  clearRibbonPosition(versionSlug: string): Promise<void>

  // Preferences
  getPreferences(): Promise<UserPreferences>
  setPreference<K>(key: K, value: ...): Promise<void>
  setPreferences(patch: ...): Promise<void>
}
```

**Current adapter**: `LocalStorageAdapter` (all data in `localStorage`).

---

## 10. Planned: Cloud Sync with Optimistic UI

### 10.1 Goals

- **Optional authentication**: app works without login; all features remain local-only
- **Cross-device sync**: when authenticated, user data syncs to the cloud
- **Offline-first**: mutations always succeed locally; sync happens in background
- **No data loss**: conflicts resolved via last-write-wins with user notification

### 10.2 Sync Scope

Not all preferences sync to the cloud. Device-dependent settings remain local-only:

| Preference | Syncs | Reason |
|------------|-------|--------|
| `locale` | Yes | User identity |
| `theme` | Yes | User identity |
| `lastVersionSlug` | Yes | Reading continuity |
| `readerFontFamily` | Yes | Aesthetic preference |
| `readerFontSize` | **No** | Depends on screen size |
| `readerLineHeight` | **No** | Depends on screen size |
| `readerContentWidth` | **No** | Depends on screen size |

### 10.3 Authentication (Supabase)

- **Provider**: Supabase Auth (email/password, Google, Apple)
- **Token**: Supabase JWT sent as `Authorization: Bearer <token>` to the backend
- **Session management**: `@supabase/ssr` for cookie-based session on the client
- **Optional**: users can use the app indefinitely without creating an account
- **Migration**: on first login, local data is pushed to the server (merge)

### 10.4 TanStack Query Integration

TanStack Query replaces manual `useState` + `useEffect` data fetching for server-synced data:

| Concern | Solution |
|---------|----------|
| Server state | `useQuery` for reads, `useMutation` for writes |
| Optimistic updates | `onMutate` → update query cache immediately |
| Rollback | `onError` → restore previous cache snapshot |
| Background sync | `onSettled` → `invalidateQueries` to reconcile |
| Offline queue | `useMutation` with `networkMode: 'offlineFirst'` |
| Stale data | `staleTime` / `gcTime` tuned per resource type |

### 10.5 Hybrid Storage Adapter

A new `HybridStorageAdapter` will implement `StorageRepository`:

```
┌─────────────────────────────────────────────┐
│              HybridStorageAdapter            │
├─────────────────────────────────────────────┤
│  if (authenticated)                          │
│    → write to localStorage (immediate)       │
│    → enqueue mutation to backend (async)     │
│    → reconcile on response                   │
│  else                                        │
│    → delegate to LocalStorageAdapter         │
└─────────────────────────────────────────────┘
```

### 10.6 Sync Flow

```
User Action
    │
    ▼
TanStack Mutation (onMutate: optimistic update)
    │
    ├──► localStorage write (immediate — offline available)
    │
    └──► API call (background)
            │
            ├── Success → update syncStatus: 'synced'
            │              invalidateQueries
            │
            └── Failure → keep syncStatus: 'pending'
                           retry on reconnect
```

### 10.7 Conflict Resolution

- **Strategy**: Last-write-wins based on `updatedAt` timestamp
- **Edge case**: If server has a newer version, client state is overwritten
- **Notification**: Toast shown when a conflict is auto-resolved
- **Full sync**: On login, `GET /sync?since={lastSyncTimestamp}` fetches all changes

---

## 11. Component Architecture

```
RootLayout
 ├── ThemeProvider (next-themes)
 ├── ReaderPreferencesProvider (typography CSS vars)
 └── [lang]/layout (I18nProvider)
      ├── HomePage
      │    ├── HomeHeader
      │    ├── VersionCards
      │    ├── VerseOfTheDay
      │    └── InstallPWA guide
      └── [version]/[book]/(reader)/layout
           └── ReaderLayoutClient
                ├── ReaderHeader
                │    ├── Logo (link home)
                │    ├── LanguageToggle
                │    ├── ThemeToggle
                │    ├── OfflineVersionButton
                │    └── Action buttons (sidebar, bookmarks, search, settings)
                ├── Sidebar (table of contents)
                ├── ReaderSettingsPanel (typography)
                ├── BibleSearchModal
                ├── BookmarksPanel / BookmarksModal
                └── <main> → ChapterClient → ChapterReader
                                              ├── VerseItem (per verse)
                                              ├── SelectionToolbar
                                              └── Chapter navigation (prev/next)
```

---

## 12. Build & Deployment

| Command | Action |
|---------|--------|
| `pnpm dev` | Local development server |
| `pnpm build` | `next build` + `next-image-export-optimizer` |
| `pnpm prod-preview` | Build + serve via `wrangler pages dev out` |

**CI/CD**: Push to main → Cloudflare Pages auto-deploys from `out/` directory.

**Output**: ~2,400 static HTML files + JS bundles + Bible JSON data + SW.
