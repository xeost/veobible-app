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
    readingMode: 'Reading mode',
    exitReadingMode: 'Exit reading mode',
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
    bookmarkTitleLabel: 'Add a title (optional)',
    bookmarkTitlePlaceholder: 'e.g. Comfort verse, favorite…',
    bookmarkSave: 'Save',
    bookmarkCancel: 'Cancel',
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
    addTitle: 'Save bookmark',
    editTitle: 'Edit title',
    titleHint: 'Give this passage a personal note',
    goTo: 'Go to passage',
    delete: 'Delete bookmark',
    deleteConfirm: 'Delete this bookmark?',
    deleteConfirmYes: 'Delete',
    deleteConfirmNo: 'Cancel',
    // Folder management
    newFolder: 'New folder',
    folderNamePlaceholder: 'Folder name…',
    renameFolder: 'Rename folder',
    deleteFolder: 'Delete folder',
    deleteFolderConfirm: 'Delete this folder? Bookmarks inside will become unfiled.',
    noFolder: 'Unfiled',
    dragToUnfolder: 'Drag here to remove from folder',
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
    verseOfTheDay: 'Verse of the Day',
    verseOfTheDaySubtitle: 'A new verse every day to inspire and encourage you',
    readInContext: 'Read in context',
    installTitle: 'Install VeoBible on your device',
    installSubtitle: 'Add VeoBible to your home screen for a native app experience — offline access, no browser UI, full screen.',
    installIos: 'iPhone & iPad (Safari)',
    installIosStep1: 'Open VeoBible in Safari.',
    installIosStep2: 'Tap the Share button (rectangle with arrow up) in the toolbar.',
    installIosStep3: 'Scroll down and tap «Add to Home Screen».',
    installIosStep4: 'Tap «Add» in the top-right corner.',
    installAndroid: 'Android (Chrome)',
    installAndroidStep1: 'Open VeoBible in Chrome.',
    installAndroidStep2: 'Tap the ⋮ menu (top-right corner).',
    installAndroidStep3: 'Tap «Add to Home screen» or «Install app».',
    installAndroidStep4: 'Confirm by tapping «Install».',
    installDesktopChrome: 'Desktop — Chrome / Edge',
    installDesktopChromeStep1: 'Open VeoBible in Chrome or Edge.',
    installDesktopChromeStep2: 'Click the install icon (⊕) in the address bar.',
    installDesktopChromeStep3: 'Click «Install» in the dialog.',
    installDesktopSafari: 'Desktop — Safari (macOS)',
    installDesktopSafariStep1: 'Open VeoBible in Safari.',
    installDesktopSafariStep2: 'Click «File» in the menu bar.',
    installDesktopSafariStep3: 'Select «Add to Dock» or use the Share menu → «Add to Dock».',
    youtubeTitle: 'Also on YouTube',
    youtubeSubtitle: 'Every book of the Bible narrated in full — one video per book, free to watch.',
    youtubeChannelEs: 'VeoBible ES',
    youtubeChannelEsDesc: 'All books narrated in Spanish (Reina Valera 1909).',
    youtubeChannelEn: 'VeoBible',
    youtubeChannelEnDesc: 'All books narrated in English (King James Version).',
    youtubeSubscribe: 'Watch on YouTube',
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
  nav: { home: string; bookmarks: string; settings: string; search: string; tableOfContents: string; readingMode: string; exitReadingMode: string }
  reader: { chapter: string; verse: string; previousChapter: string; nextChapter: string; goToChapter: string; fontSize: string; bookmark: string; bookmarkAdded: string; bookmarkRemoved: string; selectText: string; copyText: string; shareText: string; bookmarkTitleLabel: string; bookmarkTitlePlaceholder: string; bookmarkSave: string; bookmarkCancel: string }
  testament: { old: string; new: string }
  bookmarks: { title: string; empty: string; emptyDescription: string; addTitle: string; editTitle: string; titleHint: string; goTo: string; delete: string; deleteConfirm: string; deleteConfirmYes: string; deleteConfirmNo: string; newFolder: string; folderNamePlaceholder: string; renameFolder: string; deleteFolder: string; deleteFolderConfirm: string; noFolder: string; dragToUnfolder: string }
  theme: { label: string; light: string; dark: string; system: string }
  language: { label: string; en: string; es: string }
  version: { label: string; switch: string }
  home: { continueReading: string; startReading: string; chooseVersion: string; availableVersions: string; verseOfTheDay: string; verseOfTheDaySubtitle: string; readInContext: string; installTitle: string; installSubtitle: string; installIos: string; installIosStep1: string; installIosStep2: string; installIosStep3: string; installIosStep4: string; installAndroid: string; installAndroidStep1: string; installAndroidStep2: string; installAndroidStep3: string; installAndroidStep4: string; installDesktopChrome: string; installDesktopChromeStep1: string; installDesktopChromeStep2: string; installDesktopChromeStep3: string; installDesktopSafari: string; installDesktopSafariStep1: string; installDesktopSafariStep2: string; installDesktopSafariStep3: string; youtubeTitle: string; youtubeSubtitle: string; youtubeChannelEs: string; youtubeChannelEsDesc: string; youtubeChannelEn: string; youtubeChannelEnDesc: string; youtubeSubscribe: string }
  error: { notFound: string; chapterNotFound: string; goHome: string }
  meta: MetaFns
}
