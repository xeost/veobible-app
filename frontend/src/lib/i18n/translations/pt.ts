import type { Translations } from './en'

export const pt: Translations = {
  // App
  appName: 'VeoBible',
  appTagline: 'Leia a Bíblia de forma moderna',

  // Navigation
  nav: {
    home: 'Início',
    bookmarks: 'Marcadores',
    settings: 'Configurações',
    search: 'Pesquisar',
    tableOfContents: 'Índice',
    readingMode: 'Modo de leitura',
    exitReadingMode: 'Sair do modo de leitura',
  },

  // Buscador bíblico
  search: {
    title: 'Pesquisar na Bíblia',
    open: 'Pesquisar versículos',
    placeholder: 'Pesquisar versículos… (mín. 2 caracteres)',
    close: 'Fechar pesquisa',
    hint: 'Digite pelo menos 2 caracteres para pesquisar em todos os versículos desta versão.',
    searching: 'Pesquisando…',
    stillSearching: 'ainda pesquisando',
    noResults: 'Nenhum versículo encontrado',
    noResultsHint: 'Tente uma palavra ou frase diferente.',
    results: (hits: number, books: number) =>
      `${hits} ${hits === 1 ? 'versículo' : 'versículos'} em ${books} ${books === 1 ? 'livro' : 'livros'}`,
    scopeAll: 'Toda a Bíblia',
    scopeBook: 'Apenas este livro',
    setRibbonBeforeNav: 'Colocar fita marcadora antes de navegar',
  },

  // Reader
  reader: {
    chapter: 'Capítulo',
    verse: 'Versículo',
    previousChapter: 'Capítulo anterior',
    nextChapter: 'Próximo capítulo',
    goToChapter: 'Ir para o capítulo',
    fontSize: 'Tamanho da fonte',
    bookmark: 'Marcar',
    bookmarkAdded: 'Marcador adicionado',
    bookmarkRemoved: 'Marcador removido',
    selectText: 'Selecione o texto para marcar',
    copyText: 'Copiar',
    shareText: 'Compartilhar',
    bookmarkTitleLabel: 'Adicionar um título (opcional)',
    bookmarkTitlePlaceholder: 'ex. Versículo favorito, para reflexão…',
    bookmarkSave: 'Salvar',
    bookmarkCancel: 'Cancelar',
    // Typography settings
    typography: 'Tipografia',
    resetTypography: 'Redefinir tipografia',
    fontFamily: 'Fonte',
    lineHeight: 'Espaçamento entre linhas',
    lineHeight_tight: 'Compacto',
    lineHeight_normal: 'Normal',
    lineHeight_relaxed: 'Amplo',
    lineHeight_loose: 'Muito amplo',
    typographyPreview: 'No princípio era o Verbo.',
    prevFont: 'Fonte anterior',
    nextFont: 'Próxima fonte',
    fontCategory_serif: 'Serif',
    fontCategory_sans: 'Sans-serif',
    fontCategory_script: 'Cursiva / Manuscrita',
    contentWidth: 'Largura da coluna',
    contentWidth_full: 'Completo',
    contentWidth_normal: 'Normal',
    contentWidth_thin: 'Fino',
    contentWidth_veryThin: 'Muito fino',
    listenChapter: 'Ouvir este capítulo',
    watchYoutube: 'Assistir no YouTube',
    listen: 'Ouvir',
    recommendedTitle: 'Conteúdo recomendado',
  },

  // Books & Testaments
  testament: {
    old: 'Antigo Testamento',
    new: 'Novo Testamento',
  },

  // Bookmarks
  bookmarks: {
    title: 'Marcadores',
    titleWithNotes: 'Marcadores com Notas',
    openModal: 'Abrir em vista completa',
    closeModal: 'Fechar vista completa',
    empty: 'Nenhum marcador ainda',
    emptyDescription: 'Selecione qualquer texto enquanto lê para salvá-lo como marcador.',
    addTitle: 'Salvar marcador',
    editTitle: 'Editar título',
    titleHint: 'Dê uma nota pessoal a esta passagem',
    goTo: 'Ir para a passagem',
    delete: 'Excluir marcador',
    deleteConfirm: 'Excluir este marcador?',
    deleteConfirmYes: 'Excluir',
    deleteConfirmNo: 'Cancelar',
    // Notes
    noteLabel: 'Nota',
    hasNote: 'Contém uma nota',
    editNote: 'Editar nota',
    notePlaceholder: 'Escreva uma nota sobre esta passagem…',
    // Search
    searchPlaceholder: 'Pesquisar marcadores ou pastas…',
    noResults: 'Nenhum marcador corresponde à sua pesquisa',
    // Folder management
    newFolder: 'Nova pasta',
    folderNamePlaceholder: 'Nome da pasta…',
    renameFolder: 'Renomear pasta',
    deleteFolder: 'Excluir pasta',
    deleteFolderConfirm: 'Excluir esta pasta? Os marcadores dentro dela permanecerão sem pasta.',
    noFolder: 'Sem pasta',
    dragToUnfolder: 'Arraste aqui para remover da pasta',
  },

  // Reading ribbon (manual separator)
  ribbon: {
    label: 'Fita marcadora',
    set: 'Colocar fita aqui',
    update: 'Atualizar fita',
    go: 'Ir para a fita',
    clear: 'Remover fita',
    at: 'Capítulo',
    none: 'Nenhuma fita definida',
    setConfirm: 'Fita colocada',
    clearConfirm: 'Fita removida',
  },

  // Offline availability
  offline: {
    title: 'Disponibilidade offline',
    open: 'Gerenciar disponibilidade offline',
    // Status badges
    statusChecking: 'Verificando…',
    statusNotCached: 'Não disponível',
    statusPartial: 'Parcial',
    statusAvailable: 'Disponível',
    statusDownloading: 'Baixando…',
    // Descriptions
    descNotCached: 'Baixe esta versão da Bíblia para ler e pesquisar sem conexão com a internet. Uma vez baixada, as pesquisas também serão muito mais rápidas.',
    descPartial: 'Baixado parcialmente. Conclua o download para ter acesso offline completo e pesquisa rápida.',
    descAvailable: 'Esta versão está totalmente disponível offline. Você pode ler e pesquisar sem conexão com a internet.',
    descDownloading: 'Baixando todos os capítulos. Você já pode pesquisar mais rápido enquanto isso é concluído.',
    // Actions
    download: 'Baixar',
    downloadResume: 'Baixar',
    cancel: 'Cancelar download',
    delete: 'Excluir dados offline',
    deleteConfirmBtn: 'Excluir',
    deleteConfirm: 'Excluir todos os dados offline desta versão?',
    cancelDelete: 'Manter',
    // Info
    chaptersInfo: (total: number) => `${total} ${total === 1 ? 'livro' : 'livros'} na Bíblia`,
    progress: (done: number, total: number) => `${done} / ${total} livros baixados`,
    // Offline fallback page
    offlinePage: {
      title: 'Sem conexão com a internet',
      subtitle: 'Parece que você está offline. As páginas que você visitou anteriormente ainda estão disponíveis.',
      goHome: 'Ir para o início',
      goBack: 'Voltar',
      tip: 'Dica: baixe uma versão da Bíblia a partir do leitor para tê-la sempre disponível offline.',
    },
    // Reader: version not available offline
    versionNotAvailable: 'Esta versão não está disponível offline',
    versionNotAvailableDesc: 'Conecte-se à internet ou baixe esta versão a partir do leitor para lê-la offline.',
  },

  // Theme
  theme: {
    label: 'Tema',
    light: 'Claro',
    dark: 'Escuro',
    system: 'Sistema',
  },

  // Language
  language: {
    label: 'Idioma',
    en: 'Inglês',
    es: 'Espanhol',
    pt: 'Português',
  },

  // Version
  version: {
    label: 'Versão da Bíblia',
    switch: 'Mudar versão',
    chaptersTooltip: (count: number) => `${count} ${count === 1 ? 'capítulo' : 'capítulos'}`,
  },

  // Homepage
  home: {
    welcome: 'Bem-vindo ao VeoBible',
    continueReading: 'Continuar lendo',
    startReading: 'Começar a ler',
    chooseVersion: 'Escolher versão',
    availableVersions: 'Versões disponíveis',
    verseOfTheDay: 'Versículo do dia',
    verseOfTheDaySubtitle: 'Um novo versículo todos os dias para inspirar e encorajar você',
    readInContext: 'Ler no contexto',
    installTitle: 'Instalar o VeoBible no seu dispositivo',
    installSubtitle: 'Adicione o VeoBible à sua tela inicial para uma experiência de aplicativo nativo — acesso offline, sem barras de navegador, tela cheia.',
    installIos: 'iPhone e iPad (Safari)',
    installIosStep1: 'Abra o VeoBible no Safari.',
    installIosStep2: 'Toque no botão Compartilhar (retângulo com seta para cima) na barra de ferramentas.',
    installIosStep3: 'Role para baixo e toque em "Adicionar à Tela de Início".',
    installIosStep4: 'Toque em "Adicionar" no canto superior direito.',
    installAndroid: 'Android (Chrome)',
    installAndroidStep1: 'Abra o VeoBible no Chrome.',
    installAndroidStep2: 'Toque no menu ⋮ (canto superior direito).',
    installAndroidStep3: 'Toque em "Adicionar à tela inicial" ou "Instalar aplicativo".',
    installAndroidStep4: 'Confirme tocando em "Instalar".',
    installDesktopChrome: 'Desktop — Chrome / Edge',
    installDesktopChromeStep1: 'Abra o VeoBible no Chrome ou Edge.',
    installDesktopChromeStep2: 'Clique no ícone de instalação (⊕) na barra de endereço.',
    installDesktopChromeStep3: 'Clique em "Instalar" no diálogo.',
    installDesktopSafari: 'Desktop — Safari (macOS)',
    installDesktopSafariStep1: 'Abra o VeoBible no Safari.',
    installDesktopSafariStep2: 'Clique em "Arquivo" na barra de menus.',
    installDesktopSafariStep3: 'Selecione "Adicionar ao Dock" ou use o menu Compartilhar → "Adicionar ao Dock".',
    youtubeTitle: 'Também no YouTube',
    youtubeSubtitle: 'Todos os livros da Bíblia narrados na íntegra — um vídeo por livro, gratuito.',
    youtubeChannelEs: 'VeoBible ES',
    youtubeChannelEsDesc: 'Todos os livros narrados em espanhol (Reina Valera 1909).',
    youtubeChannelEn: 'VeoBible',
    youtubeChannelEnDesc: 'Todos os livros narrados em inglês (King James Version).',
    youtubeSubscribe: 'Assistir no YouTube',
  },

  // Errors
  error: {
    notFound: 'Não encontrado',
    chapterNotFound: 'Capítulo não encontrado',
    goHome: 'Ir para o início',
  },

  // Metadata
  meta: {
    chapterTitle: (book: string, chapter: number, version: string) =>
      `${book} ${chapter} - ${version} | VeoBible`,
    chapterDescription: (book: string, chapter: number, version: string, firstVerse: string) =>
      `Leia ${book} capítulo ${chapter} na ${version}. "${firstVerse}"`,
    homeTitle: 'VeoBible — Leia a Bíblia',
    homeDescription: 'Um aplicativo moderno para leitura da Bíblia com várias versões em português, espanhol e inglês.',
  },
}
