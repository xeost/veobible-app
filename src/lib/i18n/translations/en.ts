export const en = {
  // App
  appName: 'VeoBible',
  appTagline: 'Read the Bible in a modern way',

  // Navigation
  nav: {
    home: 'Home',
    bookmarks: 'Bookmarks',
    settings: 'Settings',
    search: 'Search',
    tableOfContents: 'Table of Contents',
  },

  // Reader
  reader: {
    chapter: 'Chapter',
    verse: 'Verse',
    previousChapter: 'Previous chapter',
    nextChapter: 'Next chapter',
    goToChapter: 'Go to chapter',
    fontSize: 'Font size',
    bookmark: 'Bookmark',
    bookmarkAdded: 'Bookmark added',
    bookmarkRemoved: 'Bookmark removed',
    selectText: 'Select text to bookmark',
    copyText: 'Copy',
    shareText: 'Share',
  },

  // Books & Testaments
  testament: {
    old: 'Old Testament',
    new: 'New Testament',
  },

  // Bookmarks
  bookmarks: {
    title: 'Bookmarks',
    empty: 'No bookmarks yet',
    emptyDescription: 'Select any text while reading to save it as a bookmark.',
    goTo: 'Go to passage',
    delete: 'Delete bookmark',
    deleteConfirm: 'Delete this bookmark?',
    deleteConfirmYes: 'Delete',
    deleteConfirmNo: 'Cancel',
  },

  // Theme
  theme: {
    label: 'Theme',
    light: 'Light',
    dark: 'Dark',
    system: 'System',
  },

  // Language
  language: {
    label: 'Language',
    en: 'English',
    es: 'Spanish',
  },

  // Version
  version: {
    label: 'Bible Version',
    switch: 'Switch version',
  },

  // Homepage
  home: {
    continueReading: 'Continue Reading',
    startReading: 'Start Reading',
    chooseVersion: 'Choose a Version',
    availableVersions: 'Available Versions',
  },

  // Errors
  error: {
    notFound: 'Not found',
    chapterNotFound: 'Chapter not found',
    goHome: 'Go Home',
  },

  // Metadata
  meta: {
    chapterTitle: (book: string, chapter: number, version: string) =>
      `${book} ${chapter} - ${version} | VeoBible`,
    chapterDescription: (book: string, chapter: number, version: string, firstVerse: string) =>
      `Read ${book} chapter ${chapter} in the ${version}. "${firstVerse}"`,
    homeTitle: 'VeoBible — Read the Bible',
    homeDescription: 'A modern Bible reading app with multiple versions in English and Spanish.',
  },
} as const

export type MetaFns = {
  chapterTitle: (book: string, chapter: number, version: string) => string
  chapterDescription: (book: string, chapter: number, version: string, firstVerse: string) => string
  homeTitle: string
  homeDescription: string
}

export interface Translations {
  appName: string
  appTagline: string
  nav: { home: string; bookmarks: string; settings: string; search: string; tableOfContents: string }
  reader: { chapter: string; verse: string; previousChapter: string; nextChapter: string; goToChapter: string; fontSize: string; bookmark: string; bookmarkAdded: string; bookmarkRemoved: string; selectText: string; copyText: string; shareText: string }
  testament: { old: string; new: string }
  bookmarks: { title: string; empty: string; emptyDescription: string; goTo: string; delete: string; deleteConfirm: string; deleteConfirmYes: string; deleteConfirmNo: string }
  theme: { label: string; light: string; dark: string; system: string }
  language: { label: string; en: string; es: string }
  version: { label: string; switch: string }
  home: { continueReading: string; startReading: string; chooseVersion: string; availableVersions: string }
  error: { notFound: string; chapterNotFound: string; goHome: string }
  meta: MetaFns
}
