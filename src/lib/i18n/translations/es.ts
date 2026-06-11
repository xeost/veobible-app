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
    readingMode: 'Modo de lectura',
    exitReadingMode: 'Salir del modo de lectura',
  },

  // Buscador bíblico
  search: {
    title: 'Buscar en la Biblia',
    open: 'Buscar versículos',
    placeholder: 'Buscar versículos… (mín. 2 caracteres)',
    close: 'Cerrar búsqueda',
    hint: 'Escribe al menos 2 caracteres para buscar en todos los versículos de esta versión.',
    searching: 'Buscando…',
    stillSearching: 'aún buscando',
    noResults: 'No se encontraron versículos',
    noResultsHint: 'Intenta con otra palabra o frase.',
    results: (hits: number, books: number) =>
      `${hits} ${hits === 1 ? 'versículo' : 'versículos'} en ${books} ${books === 1 ? 'libro' : 'libros'}`,
    scopeAll: 'Toda la Biblia',
    scopeBook: 'Solo este libro',
    setRibbonBeforeNav: 'Poner separador antes de navegar',
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
    // Typography settings
    typography: 'Tipografía',
    resetTypography: 'Restablecer tipografía',
    fontFamily: 'Fuente',
    lineHeight: 'Interlineado',
    lineHeight_tight: 'Compacto',
    lineHeight_normal: 'Normal',
    lineHeight_relaxed: 'Amplio',
    lineHeight_loose: 'Extra amplio',
    typographyPreview: 'En el principio era el Verbo.',
    prevFont: 'Fuente anterior',
    nextFont: 'Fuente siguiente',
    fontCategory_serif: 'Serif',
    fontCategory_sans: 'Sans-serif',
    fontCategory_script: 'Caligráficas o Manuscritas',
    contentWidth: 'Ancho de columna',
    contentWidth_full: 'Completo',
    contentWidth_normal: 'Normal',
    contentWidth_thin: 'Fino',
    contentWidth_veryThin: 'Muy fino',
    listenChapter: 'Escucha este capítulo',
    watchYoutube: 'Escuchar en YouTube',
    listen: 'Escuchar',
    recommendedTitle: 'Contenido recomendado',
  },

  // Books & Testaments
  testament: {
    old: 'Antiguo Testamento',
    new: 'Nuevo Testamento',
  },

  // Bookmarks
  bookmarks: {
    title: 'Marcadores',
    titleWithNotes: 'Marcadores con Notas',
    openModal: 'Abrir en vista completa',
    closeModal: 'Cerrar vista completa',
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
    // Notes
    noteLabel: 'Nota',
    hasNote: 'Contiene una nota',
    editNote: 'Editar nota',
    notePlaceholder: 'Escribe una nota sobre este pasaje…',
    // Search
    searchPlaceholder: 'Buscar marcadores o carpetas…',
    noResults: 'Ningún marcador coincide con tu búsqueda',
    // Folder management
    newFolder: 'Nueva carpeta',
    folderNamePlaceholder: 'Nombre de carpeta…',
    renameFolder: 'Renombrar carpeta',
    deleteFolder: 'Eliminar carpeta',
    deleteFolderConfirm: '¿Eliminar esta carpeta? Los marcadores dentro quedarán sin carpeta.',
    noFolder: 'Sin carpeta',
    dragToUnfolder: 'Arrastra aquí para sacar de la carpeta',
  },

  // Separador de lectura
  ribbon: {
    label: 'Separador de lectura',
    set: 'Poner separador aquí',
    update: 'Actualizar separador',
    go: 'Ir al separador',
    clear: 'Quitar separador',
    at: 'Capítulo',
    none: 'Sin separador establecido',
    setConfirm: 'Separador establecido',
    clearConfirm: 'Separador quitado',
  },

  // Disponibilidad offline
  offline: {
    title: 'Disponibilidad offline',
    open: 'Gestionar disponibilidad offline',
    // Badges de estado
    statusChecking: 'Verificando\u2026',
    statusNotCached: 'No disponible',
    statusPartial: 'Parcial',
    statusAvailable: 'Disponible',
    statusDownloading: 'Descargando\u2026',
    // Descripciones
    descNotCached: 'Descarga esta versión para leer y buscar sin conexión a internet. Una vez descargada, las búsquedas también serán mucho más rápidas.',
    descPartial: 'Descargada parcialmente. Completa la descarga para tener acceso offline completo y búsquedas rápidas.',
    descAvailable: 'Esta versión está completamente disponible offline. Puedes leer y buscar sin conexión a internet.',
    descDownloading: 'Descargando todos los capítulos. Ya puedes buscar más rápido mientras se completa.',
    // Acciones
    download: 'Descargar',
    downloadResume: 'Descargar',
    cancel: 'Cancelar descarga',
    delete: 'Eliminar datos offline',
    deleteConfirmBtn: 'Eliminar',
    deleteConfirm: '¿Eliminar los datos offline de esta versión?',
    cancelDelete: 'Conservar',
    // Info
    chaptersInfo: (total: number) => `${total} ${total === 1 ? 'libro' : 'libros'} en la Biblia`,
    progress: (done: number, total: number) => `${done} / ${total} libros descargados`,
    // Página de fallback offline
    offlinePage: {
      title: 'Sin conexión a internet',
      subtitle: 'Parece que estás sin conexión. Las páginas que ya visitaste siguen disponibles.',
      goHome: 'Ir al inicio',
      goBack: 'Volver',
      tip: 'Consejo: descarga una versión de la Biblia desde el lector para tenerla siempre disponible sin conexión.',
    },
    // Reader: versión no disponible offline
    versionNotAvailable: 'Esta versión no está disponible sin conexión',
    versionNotAvailableDesc: 'Conéctate a internet o descarga esta versión desde el lector para leerla sin conexión.',
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
    chaptersTooltip: (count: number) => `${count} ${count === 1 ? 'capítulo' : 'capítulos'}`,
  },

  // Homepage
  home: {
    welcome: 'Bienvenido a VeoBible',
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
