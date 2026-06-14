'use client'

import React, { useRef, useState } from 'react'
import type { Bookmark, BookmarkFolder } from '@/lib/storage'
import type { BookInfo } from '@/lib/bible/types'
import { BookmarkCard } from './BookmarkCard'
import { useI18n } from '@/lib/i18n/client'
import { Tooltip } from '@/components/ui/Tooltip'
import { useTouchDrag, TOUCH_DROP_ATTR, TOUCH_FOLDER_ATTR, TOUCH_BOOK_ATTR, TOUCH_DROP_ACTIVE_CLASS } from '@/hooks/useTouchDrag'

// ── Icons ────────────────────────────────────────────────────────────

const FolderIcon = ({ open }: { open: boolean }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill={open ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ opacity: 0.7 }}
  >
    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
  </svg>
)

const PlusIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

const FolderPlusIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    <line x1="12" y1="11" x2="12" y2="17" />
    <line x1="9" y1="14" x2="15" y2="14" />
  </svg>
)

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{
      transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
      transition: 'transform 200ms ease',
    }}
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
)

const PencilSmIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

const TrashSmIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
  </svg>
)

// ── Types ────────────────────────────────────────────────────────────

interface BookmarkGroupByBookProps {
  lang: string
  versionSlug: string
  bookmarks: Bookmark[]
  folders: BookmarkFolder[]
  books: BookInfo[]          // canonical ordered list from bible index
  removeBookmark: (id: string) => Promise<void>
  updateBookmark: (id: string, patch: Partial<Omit<Bookmark, 'id' | 'createdAt'>>) => Promise<Bookmark>
  addFolder: (data: Omit<BookmarkFolder, 'id' | 'createdAt' | 'updatedAt'>) => Promise<BookmarkFolder>
  updateFolder: (id: string, patch: Partial<Omit<BookmarkFolder, 'id' | 'createdAt'>>) => Promise<BookmarkFolder>
  removeFolder: (id: string) => Promise<void>
  moveBookmarkToFolder: (bookmarkId: string, folderId: string | undefined) => Promise<void>
}

// ── Folder Drop Zone ─────────────────────────────────────────────────

// Encode book slug as a dataTransfer type so it's readable during dragover
// (getData is restricted in dragover in many browsers, but types[] is always available)
export const bookSlugDragType = (slug: string) => `application/x-bookmark-book-${slug.toLowerCase()}`

interface FolderDropZoneProps {
  folderId: string | undefined   // undefined = "unfiled" zone
  bookSlug: string               // Only accept drops from this book
  onDrop: (bookmarkId: string, folderId: string | undefined) => void
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

function FolderDropZone({ folderId, bookSlug, onDrop, children, className, style }: FolderDropZoneProps) {
  const [dragOver, setDragOver] = useState(false)

  const isValidDrag = (e: React.DragEvent) =>
    e.dataTransfer.types.includes(bookSlugDragType(bookSlug))

  const handleDragOver = (e: React.DragEvent) => {
    if (!isValidDrag(e)) return   // wrong book — don't accept
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(true)
  }
  const handleDragLeave = () => setDragOver(false)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (!isValidDrag(e)) return
    const bookmarkId = e.dataTransfer.getData('bookmarkId')
    if (bookmarkId) onDrop(bookmarkId, folderId)
  }

  return (
    <div
      className={className}
      style={{
        ...style,
        outline: dragOver ? '2px solid var(--brand)' : 'none',
        outlineOffset: '-2px',
        borderRadius: '10px',
        transition: 'outline 100ms',
      }}
      // HTML5 drag events
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      // Touch drag attributes — read by useTouchDrag via elementFromPoint
      {...{ [TOUCH_DROP_ATTR]: 'true' }}
      {...{ [TOUCH_FOLDER_ATTR]: folderId ?? 'unfiled' }}
      {...{ [TOUCH_BOOK_ATTR]: bookSlug }}
    >
      {children}
    </div>
  )
}

// ── Inline name input ─────────────────────────────────────────────────

interface InlineInputProps {
  initialValue: string
  placeholder: string
  onConfirm: (value: string) => void
  onCancel: () => void
}

function InlineInput({ initialValue, placeholder, onConfirm, onCancel }: InlineInputProps) {
  const [value, setValue] = useState(initialValue)
  const ref = useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])

  const confirm = () => {
    if (value.trim()) onConfirm(value.trim())
    else onCancel()
  }

  return (
    <input
      ref={ref}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder={placeholder}
      maxLength={60}
      onKeyDown={(e) => {
        if (e.key === 'Enter') confirm()
        if (e.key === 'Escape') onCancel()
      }}
      onBlur={confirm}
      className="flex-1 rounded-lg px-2 py-0.5 text-xs outline-none"
      style={{
        background: 'var(--bg-page)',
        border: '1.5px solid var(--brand)',
        color: 'var(--text-primary)',
        minWidth: 0,
      }}
    />
  )
}

// ── Folder Row ────────────────────────────────────────────────────────

interface FolderRowProps {
  folder: BookmarkFolder
  bookmarks: Bookmark[]
  lang: string
  bookName: string
  onDrop: (bookmarkId: string, folderId: string | undefined) => void
  onTouchDrop: (e: React.TouchEvent, bookmarkId: string, bookSlug: string, cardEl: HTMLElement) => void
  removeBookmark: (id: string) => Promise<void>
  updateBookmark: (id: string, patch: Partial<Omit<Bookmark, 'id' | 'createdAt'>>) => Promise<Bookmark>
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  expandedIds: Set<string>
  onToggleCard: (id: string) => void
}

function FolderRow({ folder, bookmarks, lang, bookName, onDrop, onTouchDrop, removeBookmark, updateBookmark, onRename, onDelete, expandedIds, onToggleCard }: FolderRowProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const count = bookmarks.length

  return (
    <div className="mb-1">
      {/* Folder header — also a drop target */}
      <FolderDropZone folderId={folder.id} bookSlug={folder.bookSlug} onDrop={onDrop}>
        <div
          className="group flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer select-none"
          style={{
            background: open ? 'var(--bg-card)' : 'transparent',
          }}
          onMouseEnter={(e) => { if (!open) e.currentTarget.style.background = 'var(--bg-hover, rgba(0,0,0,.04))' }}
          onMouseLeave={(e) => { if (!open) e.currentTarget.style.background = 'transparent' }}
        >
          {/* Toggle button */}
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-1.5 flex-1 min-w-0"
            aria-expanded={open}
          >
            <span style={{ color: 'var(--brand)' }}>
              <ChevronIcon open={open} />
            </span>
            <span style={{ color: 'var(--brand)' }}>
              <FolderIcon open={open} />
            </span>

            {renaming ? (
              <InlineInput
                initialValue={folder.name}
                placeholder={t.bookmarks.folderNamePlaceholder}
                onConfirm={(name) => { setRenaming(false); onRename(folder.id, name) }}
                onCancel={() => setRenaming(false)}
              />
            ) : (
              <>
                <span
                  className="text-xs font-semibold truncate"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {folder.name}
                </span>
                <span
                  className="text-xs ml-0.5"
                  style={{ color: 'var(--text-muted)' }}
                >
                  ({count})
                </span>
              </>
            )}
          </button>

          {/* Folder actions */}
          {!renaming && !confirmDelete && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <Tooltip content={t.bookmarks.renameFolder} placement="top">
                <button
                  onClick={(e) => { e.stopPropagation(); setRenaming(true) }}
                  className="p-1 rounded"
                  style={{ color: 'var(--text-muted)' }}
                  aria-label={t.bookmarks.renameFolder}
                >
                  <PencilSmIcon />
                </button>
              </Tooltip>
              <Tooltip content={t.bookmarks.deleteFolder} placement="top">
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(true) }}
                  className="p-1 rounded"
                  style={{ color: 'var(--text-muted)' }}
                  aria-label={t.bookmarks.deleteFolder}
                >
                  <TrashSmIcon />
                </button>
              </Tooltip>
            </div>
          )}

          {/* Delete confirmation inline */}
          {confirmDelete && (
            <div className="flex items-center gap-1 ml-1" onClick={(e) => e.stopPropagation()}>
              <button
                className="text-xs font-semibold px-2 py-0.5 rounded"
                style={{ background: '#ef4444', color: 'white' }}
                onClick={() => { setConfirmDelete(false); onDelete(folder.id) }}
              >
                {t.bookmarks.deleteConfirmYes}
              </button>
              <button
                className="text-xs"
                style={{ color: 'var(--text-muted)' }}
                onClick={() => setConfirmDelete(false)}
              >
                {t.bookmarks.deleteConfirmNo}
              </button>
            </div>
          )}
        </div>
      </FolderDropZone>

      {/* Folder contents */}
      {open && (
        <FolderDropZone
          folderId={folder.id}
          bookSlug={folder.bookSlug}
          onDrop={onDrop}
          className="pl-5 flex flex-col gap-1 mt-1"
        >
          {bookmarks.length === 0 ? (
            <p
              className="text-xs italic py-2 px-2"
              style={{ color: 'var(--text-muted)' }}
            >
              —
            </p>
          ) : (
            bookmarks.map((bm) => (
              <BookmarkCard
                key={bm.id}
                bookmark={bm}
                lang={lang}
                bookName={bookName}
                onRemove={removeBookmark}
                onUpdate={async (id, patch) => { await updateBookmark(id, patch) }}
                isExpanded={expandedIds.has(bm.id)}
                onToggleExpand={() => onToggleCard(bm.id)}
                draggable
                onTouchDrop={onTouchDrop}
              />
            ))
          )}
        </FolderDropZone>
      )}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────

export function BookmarkGroupByBook({
  lang,
  versionSlug,
  bookmarks,
  folders,
  books,
  removeBookmark,
  updateBookmark,
  addFolder,
  updateFolder,
  removeFolder,
  moveBookmarkToFolder,
}: BookmarkGroupByBookProps) {
  const { t } = useI18n()

  // Touch drag — mirrors HTML5 drag for folder drop on mobile
  const { onGripTouchStart, isTouchDragging, touchDraggingBookSlug } = useTouchDrag({ onDrop: async (bookmarkId, folderId) => {
    await moveBookmarkToFolder(bookmarkId, folderId)
  }})

  // Set of expanded bookmark ids (default: all collapsed)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  // Track which book is showing the "new folder" input
  const [addingFolderFor, setAddingFolderFor] = useState<string | null>(null)
  // True while any bookmark card is being dragged
  const [isDragging, setIsDragging] = useState(false)
  // bookSlug of the bookmark being dragged (to show hint only in the right group)
  const [draggingBookSlug, setDraggingBookSlug] = useState<string | null>(null)

  // Use window-level listeners so dragend/drop always reset the flag,
  // even when a React re-render happens between drop and dragend.
  React.useEffect(() => {
    const onStart = (e: DragEvent) => {
      setIsDragging(true)
      // Decode bookSlug from the custom type (format: application/x-bookmark-book-{slug})
      const bookType = Array.from(e.dataTransfer?.types ?? []).find((t) =>
        t.startsWith('application/x-bookmark-book-'),
      )
      setDraggingBookSlug(bookType ? bookType.replace('application/x-bookmark-book-', '') : null)
    }
    const onEnd = () => {
      setIsDragging(false)
      setDraggingBookSlug(null)
    }
    window.addEventListener('dragstart', onStart)
    window.addEventListener('dragend', onEnd)
    window.addEventListener('drop', onEnd)
    return () => {
      window.removeEventListener('dragstart', onStart)
      window.removeEventListener('dragend', onEnd)
      window.removeEventListener('drop', onEnd)
    }
  }, [])

  const toggleCard = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /** Expand or collapse all bookmark cards belonging to a book group */
  const toggleAllInBook = (slugBookmarks: Bookmark[]) => {
    const ids = slugBookmarks.map((b) => b.id)
    const allExpanded = ids.every((id) => expandedIds.has(id))
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (allExpanded) {
        ids.forEach((id) => next.delete(id))
      } else {
        ids.forEach((id) => next.add(id))
      }
      return next
    })
  }

  // Build a canonical order map from the bible index (books may be empty while loading)
  const bookOrder = React.useMemo(() => {
    const map = new Map<string, number>()
    books.forEach((b, i) => map.set(b.slug, i))
    return map
  }, [books])

  // Group bookmarks by bookSlug
  const groupedByBook = React.useMemo(() => {
    const map = new Map<string, Bookmark[]>()
    for (const bm of bookmarks) {
      const arr = map.get(bm.bookSlug) ?? []
      arr.push(bm)
      map.set(bm.bookSlug, arr)
    }
    // Sort each group by chapter, then verseStart
    Array.from(map.values()).forEach((arr: Bookmark[]) => {
      arr.sort((a: Bookmark, b: Bookmark) =>
        a.chapter !== b.chapter ? a.chapter - b.chapter : a.verseStart - b.verseStart,
      )
    })
    return map
  }, [bookmarks])

  // Get book slugs sorted by canonical order (fallback: alphabetical)
  const sortedBookSlugs = React.useMemo(() => {
    const slugs = Array.from(groupedByBook.keys())
    return slugs.sort((a, b) => {
      const oa = bookOrder.get(a) ?? 9999
      const ob = bookOrder.get(b) ?? 9999
      return oa - ob
    })
  }, [groupedByBook, bookOrder])

  // Get display name for a book slug
  const bookName = (slug: string): string => {
    const found = books.find((b) => b.slug === slug)
    return found ? found.name : slug.replace(/-/g, ' ')
  }

  // Handlers
  const handleDrop = async (bookmarkId: string, folderId: string | undefined) => {
    await moveBookmarkToFolder(bookmarkId, folderId)
  }

  const handleAddFolder = async (bookSlug: string, name: string) => {
    const bookFolders = folders.filter((f) => f.bookSlug === bookSlug)
    await addFolder({
      versionSlug,
      bookSlug,
      name,
      order: bookFolders.length,
    })
    setAddingFolderFor(null)
  }

  const handleRenameFolder = async (id: string, name: string) => {
    await updateFolder(id, { name })
  }

  const handleDeleteFolder = async (id: string) => {
    await removeFolder(id)
  }

  if (bookmarks.length === 0) return null

  return (
    <div className="flex flex-col gap-1">
      {sortedBookSlugs.map((bookSlug) => {
        const bookBookmarks = groupedByBook.get(bookSlug) ?? []
        const bookFolders = folders.filter((f) => f.bookSlug === bookSlug)
        const allExpanded = bookBookmarks.length > 0 && bookBookmarks.every((b) => expandedIds.has(b.id))

        // Bookmarks inside each folder
        const bookmarksInFolder = (folderId: string) =>
          bookBookmarks.filter((bm) => bm.folderId === folderId)
        // Bookmarks not in any folder
        const unfiledBookmarks = bookBookmarks.filter((bm) => !bm.folderId)

        const renderCard = (bm: Bookmark) => (
          <BookmarkCard
            key={bm.id}
            bookmark={bm}
            lang={lang}
            bookName={bookName(bookSlug)}
            onRemove={removeBookmark}
            onUpdate={async (id, patch) => { await updateBookmark(id, patch) }}
            isExpanded={expandedIds.has(bm.id)}
            onToggleExpand={() => toggleCard(bm.id)}
            draggable
            onTouchDrop={onGripTouchStart}
          />
        )

        return (
          <div key={bookSlug} className="mb-2">
            {/* Book group header */}
            <div
              className="flex items-center gap-1 px-3 pb-2 select-none"
              style={{
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg-sidebar)',
              }}
            >
              <span
                className="flex-1 text-xs font-bold uppercase tracking-widest"
                style={{ color: 'var(--text-primary)', letterSpacing: '0.08em' }}
              >
                {bookName(bookSlug)}
                <span className="ml-1.5 font-normal normal-case tracking-normal" style={{ color: 'var(--text-muted)' }}>
                  ({bookBookmarks.length})
                </span>
              </span>

              {/* Add-folder icon button — always visible, never overflows header */}
              <Tooltip content={t.bookmarks.newFolder} placement="top">
                <button
                  onClick={(e) => { e.stopPropagation(); setAddingFolderFor(bookSlug) }}
                  className="btn-icon p-1 flex-shrink-0"
                  aria-label={t.bookmarks.newFolder}
                  id={`add-folder-${bookSlug}`}
                  style={{ color: 'var(--text-muted)' }}
                >
                  <FolderPlusIcon />
                </button>
              </Tooltip>

              {/* Expand / collapse all cards in this book group */}
              <Tooltip content={allExpanded ? 'Collapse all' : 'Expand all'} placement="top">
                <button
                  onClick={() => toggleAllInBook(bookBookmarks)}
                  className="btn-icon p-1 flex-shrink-0"
                  aria-label={allExpanded ? 'Collapse all' : 'Expand all'}
                  style={{ color: 'var(--text-muted)' }}
                >
                  <svg
                    width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ transform: allExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 180ms ease' }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              </Tooltip>
            </div>

            {/* Group content */}
            <div className="flex flex-col gap-1 px-2 mt-2 mb-1">
              {/* Folders */}
              {bookFolders.map((folder) => (
                <FolderRow
                  key={folder.id}
                  folder={folder}
                  bookmarks={bookmarksInFolder(folder.id)}
                  lang={lang}
                  bookName={bookName(bookSlug)}
                  onDrop={handleDrop}
                  onTouchDrop={onGripTouchStart}
                  removeBookmark={removeBookmark}
                  updateBookmark={updateBookmark}
                  onRename={handleRenameFolder}
                  onDelete={handleDeleteFolder}
                  expandedIds={expandedIds}
                  onToggleCard={toggleCard}
                />
              ))}

              {/* New folder input row — appears inside the content area, below existing folders */}
              {addingFolderFor === bookSlug && (
                <div
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--brand)',
                  }}
                >
                  <span style={{ color: 'var(--brand)', flexShrink: 0 }}>
                    <FolderIcon open={false} />
                  </span>
                  <InlineInput
                    initialValue=""
                    placeholder={t.bookmarks.folderNamePlaceholder}
                    onConfirm={(name) => handleAddFolder(bookSlug, name)}
                    onCancel={() => setAddingFolderFor(null)}
                  />
                </div>
              )}

              {/* Unfiled bookmarks drop zone — always present so cards inside folders can be dragged out */}
              <FolderDropZone
                folderId={undefined}
                bookSlug={bookSlug}
                onDrop={handleDrop}
                className="flex flex-col gap-1"
              >
                {unfiledBookmarks.map(renderCard)}
                {/* Drop hint: only while dragging a card from THIS book group, and all its bookmarks are in folders */}
                {/* Drop hint: visible while dragging a card from THIS book group when all bookmarks are in folders.
                   Shown for both mouse drag (isDragging) and touch drag (isTouchDragging). */}
                {(isDragging || isTouchDragging) &&
                  (draggingBookSlug === bookSlug || touchDraggingBookSlug === bookSlug) &&
                  unfiledBookmarks.length === 0 &&
                  bookFolders.length > 0 && (
                  <div
                    className="text-xs italic text-center py-1.5 px-2 rounded-lg"
                    style={{
                      border: '1.5px dashed var(--border-strong)',
                      color: 'var(--text-muted)',
                      opacity: 0.6,
                    }}
                  >
                    {t.bookmarks.dragToUnfolder}
                  </div>
                )}
              </FolderDropZone>
            </div>
          </div>
        )
      })}
    </div>
  )
}

