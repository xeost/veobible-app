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
    bookmarkTitleLabel: 'Agregar un título (opcional)',
    bookmarkTitlePlaceholder: 'ej. Versículo favorito, para reflexionar…',
    bookmarkSave: 'Guardar',
    bookmarkCancel: 'Cancelar',
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
    addTitle: 'Guardar marcador',
    editTitle: 'Editar título',
    titleHint: 'Dale una nota personal a este pasaje',
    goTo: 'Ir al pasaje',
    delete: 'Eliminar marcador',
    deleteConfirm: '¿Eliminar este marcador?',
    deleteConfirmYes: 'Eliminar',
    deleteConfirmNo: 'Cancelar',
    // Folder management
    newFolder: 'Nueva carpeta',
    folderNamePlaceholder: 'Nombre de carpeta…',
    renameFolder: 'Renombrar carpeta',
    deleteFolder: 'Eliminar carpeta',
    deleteFolderConfirm: '¿Eliminar esta carpeta? Los marcadores dentro quedarán sin carpeta.',
    noFolder: 'Sin carpeta',
    dragToUnfolder: 'Arrastra aquí para sacar de la carpeta',
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
    verseOfTheDay: 'Versículo del día',
    verseOfTheDaySubtitle: 'Un nuevo versículo cada día para inspirarte y alentarte',
    readInContext: 'Leer en contexto',
    installTitle: 'Instala VeoBible en tu dispositivo',
    installSubtitle: 'Agrega VeoBible a tu pantalla de inicio para una experiencia como aplicación nativa — acceso sin conexión, sin barra del navegador, pantalla completa.',
    installIos: 'iPhone y iPad (Safari)',
    installIosStep1: 'Abre VeoBible en Safari.',
    installIosStep2: 'Toca el botón Compartir (rectángulo con flecha hacia arriba) en la barra de herramientas.',
    installIosStep3: 'Desplázate hacia abajo y toca «Agregar a pantalla de inicio».',
    installIosStep4: 'Toca «Agregar» en la esquina superior derecha.',
    installAndroid: 'Android (Chrome)',
    installAndroidStep1: 'Abre VeoBible en Chrome.',
    installAndroidStep2: 'Toca el menú ⋮ (esquina superior derecha).',
    installAndroidStep3: 'Toca «Añadir a pantalla de inicio» o «Instalar aplicación».',
    installAndroidStep4: 'Confirma tocando «Instalar».',
    installDesktopChrome: 'Escritorio — Chrome / Edge',
    installDesktopChromeStep1: 'Abre VeoBible en Chrome o Edge.',
    installDesktopChromeStep2: 'Haz clic en el ícono de instalación (⊕) en la barra de direcciones.',
    installDesktopChromeStep3: 'Haz clic en «Instalar» en el diálogo.',
    installDesktopSafari: 'Escritorio — Safari (macOS)',
    installDesktopSafariStep1: 'Abre VeoBible en Safari.',
    installDesktopSafariStep2: 'Haz clic en «Archivo» en la barra de menú.',
    installDesktopSafariStep3: 'Selecciona «Agregar al Dock» o usa el menú Compartir → «Agregar al Dock».',
    youtubeTitle: 'También en YouTube',
    youtubeSubtitle: 'Todos los libros de la Biblia narrados completos — un video por libro, gratis.',
    youtubeChannelEs: 'VeoBible ES',
    youtubeChannelEsDesc: 'Todos los libros narrados en español (Reina Valera 1909).',
    youtubeChannelEn: 'VeoBible',
    youtubeChannelEnDesc: 'Todos los libros narrados en inglés (King James Version).',
    youtubeSubscribe: 'Ver en YouTube',
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
