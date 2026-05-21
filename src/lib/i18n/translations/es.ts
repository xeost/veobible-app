import type { Translations } from './en'

export const es: Translations = {
  // App
  appName: 'VeoBible',
  appTagline: 'Lee la Biblia de una forma moderna',

  // Navigation
  nav: {
    home: 'Inicio',
    bookmarks: 'Marcadores',
    settings: 'Ajustes',
    search: 'Buscar',
    tableOfContents: 'Tabla de contenido',
  },

  // Reader
  reader: {
    chapter: 'Capítulo',
    verse: 'Versículo',
    previousChapter: 'Capítulo anterior',
    nextChapter: 'Capítulo siguiente',
    goToChapter: 'Ir al capítulo',
    fontSize: 'Tamaño de letra',
    bookmark: 'Marcar',
    bookmarkAdded: 'Marcador añadido',
    bookmarkRemoved: 'Marcador eliminado',
    selectText: 'Selecciona texto para marcarlo',
    copyText: 'Copiar',
    shareText: 'Compartir',
  },

  // Books & Testaments
  testament: {
    old: 'Antiguo Testamento',
    new: 'Nuevo Testamento',
  },

  // Bookmarks
  bookmarks: {
    title: 'Marcadores',
    empty: 'Aún no hay marcadores',
    emptyDescription: 'Selecciona cualquier texto mientras lees para guardarlo como marcador.',
    goTo: 'Ir al pasaje',
    delete: 'Eliminar marcador',
    deleteConfirm: '¿Eliminar este marcador?',
    deleteConfirmYes: 'Eliminar',
    deleteConfirmNo: 'Cancelar',
  },

  // Theme
  theme: {
    label: 'Tema',
    light: 'Claro',
    dark: 'Oscuro',
    system: 'Sistema',
  },

  // Language
  language: {
    label: 'Idioma',
    en: 'Inglés',
    es: 'Español',
  },

  // Version
  version: {
    label: 'Versión de la Biblia',
    switch: 'Cambiar versión',
  },

  // Homepage
  home: {
    continueReading: 'Continuar leyendo',
    startReading: 'Comenzar a leer',
    chooseVersion: 'Elegir versión',
    availableVersions: 'Versiones disponibles',
  },

  // Errors
  error: {
    notFound: 'No encontrado',
    chapterNotFound: 'Capítulo no encontrado',
    goHome: 'Ir al inicio',
  },

  // Metadata
  meta: {
    chapterTitle: (book: string, chapter: number, version: string) =>
      `${book} ${chapter} - ${version} | VeoBible`,
    chapterDescription: (book: string, chapter: number, version: string, firstVerse: string) =>
      `Lee ${book} capítulo ${chapter} en ${version}. "${firstVerse}"`,
    homeTitle: 'VeoBible — Lee la Biblia',
    homeDescription: 'Una app moderna para leer la Biblia en múltiples versiones en inglés y español.',
  },
} as const
