import { isValidISO } from './timestamps.ts'

export type ValidationError = { field: string; issue: string }

// ── Primitive validators ──────────────────────────────────────────────────────

function reqString(v: unknown, field: string): ValidationError | null {
  if (v === undefined || v === null) return { field, issue: 'required' }
  if (typeof v !== 'string' || v.trim() === '') return { field, issue: 'mustBeNonEmptyString' }
  return null
}

function optString(v: unknown, field: string): ValidationError | null {
  if (v === undefined || v === null) return null
  if (typeof v !== 'string') return { field, issue: 'mustBeString' }
  return null
}

function reqPosInt(v: unknown, field: string): ValidationError | null {
  if (v === undefined || v === null) return { field, issue: 'required' }
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) {
    return { field, issue: 'mustBePositiveInteger' }
  }
  return null
}

function reqISO(v: unknown, field: string): ValidationError | null {
  if (v === undefined || v === null) return { field, issue: 'required' }
  if (!isValidISO(v)) return { field, issue: 'mustBeISO8601' }
  return null
}

function collect(...errs: Array<ValidationError | null>): ValidationError[] {
  return errs.filter((e): e is ValidationError => e !== null)
}

// ── Request body validators ───────────────────────────────────────────────────

export function validateBookmarkCreate(body: unknown): ValidationError[] {
  if (typeof body !== 'object' || body === null) return [{ field: 'body', issue: 'mustBeObject' }]
  const b = body as Record<string, unknown>
  return collect(
    reqString(b.id, 'id'),
    reqString(b.versionSlug, 'versionSlug'),
    reqString(b.bookSlug, 'bookSlug'),
    reqPosInt(b.chapter, 'chapter'),
    reqPosInt(b.verseStart, 'verseStart'),
    reqPosInt(b.verseEnd, 'verseEnd'),
    reqString(b.selectedText, 'selectedText'),
    reqISO(b.createdAt, 'createdAt'),
    reqISO(b.updatedAt, 'updatedAt'),
    optString(b.title, 'title'),
    optString(b.note, 'note'),
    optString(b.folderId, 'folderId'),
  )
}

export function validateBookmarkUpdate(body: unknown): ValidationError[] {
  if (typeof body !== 'object' || body === null) return [{ field: 'body', issue: 'mustBeObject' }]
  const b = body as Record<string, unknown>
  return collect(
    reqISO(b.updatedAt, 'updatedAt'),
    optString(b.title, 'title'),
    optString(b.note, 'note'),
    optString(b.folderId, 'folderId'),
  )
}

export function validateFolderCreate(body: unknown): ValidationError[] {
  if (typeof body !== 'object' || body === null) return [{ field: 'body', issue: 'mustBeObject' }]
  const b = body as Record<string, unknown>
  const orderErr = b.order === undefined || b.order === null
    ? { field: 'order', issue: 'required' }
    : typeof b.order !== 'number' || !Number.isInteger(b.order) || b.order < 0
      ? { field: 'order', issue: 'mustBeNonNegativeInteger' }
      : null
  return collect(
    reqString(b.id, 'id'),
    reqString(b.versionSlug, 'versionSlug'),
    reqString(b.bookSlug, 'bookSlug'),
    reqString(b.name, 'name'),
    orderErr,
    reqISO(b.createdAt, 'createdAt'),
    reqISO(b.updatedAt, 'updatedAt'),
  )
}

export function validateFolderUpdate(body: unknown): ValidationError[] {
  if (typeof body !== 'object' || body === null) return [{ field: 'body', issue: 'mustBeObject' }]
  const b = body as Record<string, unknown>
  const orderErr = b.order !== undefined && b.order !== null
    ? (typeof b.order !== 'number' || !Number.isInteger(b.order) || b.order < 0
      ? { field: 'order', issue: 'mustBeNonNegativeInteger' }
      : null)
    : null
  return collect(
    reqISO(b.updatedAt, 'updatedAt'),
    optString(b.name, 'name'),
    orderErr,
  )
}

export function validateReadingPositionUpsert(body: unknown): ValidationError[] {
  if (typeof body !== 'object' || body === null) return [{ field: 'body', issue: 'mustBeObject' }]
  const b = body as Record<string, unknown>
  const verseIndexErr = b.verseIndex !== undefined && b.verseIndex !== null
    ? (typeof b.verseIndex !== 'number' || !Number.isInteger(b.verseIndex) || b.verseIndex < 0
      ? { field: 'verseIndex', issue: 'mustBeNonNegativeInteger' }
      : null)
    : null
  return collect(
    reqString(b.bookSlug, 'bookSlug'),
    reqPosInt(b.chapter, 'chapter'),
    verseIndexErr,
    reqISO(b.updatedAt, 'updatedAt'),
  )
}

export function validateReadingRibbonUpsert(body: unknown): ValidationError[] {
  if (typeof body !== 'object' || body === null) return [{ field: 'body', issue: 'mustBeObject' }]
  const b = body as Record<string, unknown>
  return collect(
    reqString(b.bookSlug, 'bookSlug'),
    reqPosInt(b.chapter, 'chapter'),
    reqISO(b.updatedAt, 'updatedAt'),
  )
}

export function validatePreferencesUpsert(body: unknown): ValidationError[] {
  if (typeof body !== 'object' || body === null) return [{ field: 'body', issue: 'mustBeObject' }]
  return []
}
