/**
 * Internationalization (i18n) module for Audiobibles CLI.
 * Provides localized prompts, YouTube titles, and descriptions for generated content.
 * Easily extensible for adding content generation support for new languages.
 */

export interface LocaleConfig {
  code: string;
  youtube: {
    bibleTerm: string;
    audioBibleTerm: string;
    chapterLabel: string;
    chaptersHeading: string;
    aboutVersionHeading: (versionName: string) => string;
    readOnlineHeading: string;
    readOnlineText: (bookName: string, versionName: string, bookUrl: string) => string;
  };
  imagePrompt: (params: {
    bookName: string;
    bookDescription: string;
    versionLabel: string;
  }) => string;
}

export const locales: Record<string, LocaleConfig> = {
  es: {
    code: "es",
    youtube: {
      bibleTerm: "Santa Biblia",
      audioBibleTerm: "Audio Biblia",
      chapterLabel: "Capítulo",
      chaptersHeading: "📌 Capítulos",
      aboutVersionHeading: (versionName: string) => `📖 Sobre esta versión — ${versionName}`,
      readOnlineHeading: "🔗 Leer en línea",
      readOnlineText: (bookName: string, versionName: string, bookUrl: string) =>
        `Encuentra el libro de ${bookName} en ${versionName} en:\n${bookUrl}`,
    },
    imagePrompt: ({ bookName, bookDescription, versionLabel }) =>
      `Crea una imagen de portada cinematográfica y de alta calidad para un video de La Biblia Hablada.

📖 Libro: ${bookName}
🕊️ Versión: ${versionLabel}

Contexto del libro:
${bookDescription}

Requisitos de la imagen:
- Formato horizontal (16:9), resolución al menos 1920×1080
- Estilo: pintura épica o ilustración bíblica solemne
- Colores ricos y dramáticos (dorados, azules profundos, tonos de desierto)
- El texto del título estará superpuesto después, así que deja espacio visual limpio
- Sin texto dentro de la imagen
- Atmósfera: reverente, atemporal, impactante`,
  },

  en: {
    code: "en",
    youtube: {
      bibleTerm: "Holy Bible",
      audioBibleTerm: "Audio Bible",
      chapterLabel: "Chapter",
      chaptersHeading: "📌 Chapters",
      aboutVersionHeading: (versionName: string) => `📖 About this version — ${versionName}`,
      readOnlineHeading: "🔗 Read online",
      readOnlineText: (bookName: string, versionName: string, bookUrl: string) =>
        `Find the book of ${bookName} in ${versionName} at:\n${bookUrl}`,
    },
    imagePrompt: ({ bookName, bookDescription, versionLabel }) =>
      `Create a cinematic, high-quality cover image for an Audiobible video.

📖 Book: ${bookName}
🕊️ Version: ${versionLabel}

Book context:
${bookDescription}

Image requirements:
- Horizontal format (16:9), at least 1920×1080 resolution
- Style: epic painting or solemn biblical illustration
- Rich and dramatic colors (golds, deep blues, desert tones)
- The title text will be overlaid separately, so leave clean visual space
- No text inside the image
- Atmosphere: reverent, timeless, impactful`,
  },

  pt: {
    code: "pt",
    youtube: {
      bibleTerm: "Bíblia Sagrada",
      audioBibleTerm: "Bíblia em Áudio",
      chapterLabel: "Capítulo",
      chaptersHeading: "📌 Capítulos",
      aboutVersionHeading: (versionName: string) => `📖 Sobre esta versão — ${versionName}`,
      readOnlineHeading: "🔗 Ler online",
      readOnlineText: (bookName: string, versionName: string, bookUrl: string) =>
        `Encontre o livro de ${bookName} em ${versionName} em:\n${bookUrl}`,
    },
    imagePrompt: ({ bookName, bookDescription, versionLabel }) =>
      `Crie uma imagem de capa cinematográfica e de alta qualidade para um vídeo da Bíblia em Áudio.

📖 Livro: ${bookName}
🕊️ Versão: ${versionLabel}

Contexto do livro:
${bookDescription}

Requisitos da imagem:
- Formato horizontal (16:9), resolução de pelo menos 1920×1080
- Estilo: pintura épica ou ilustração bíblica solene
- Cores ricas e dramáticas (dourados, azuis profundos, tons de deserto)
- O texto do título será sobreposto depois, então deixe um espaço visual limpo
- Sem texto dentro da imagem
- Atmosfera: reverente, atemporal, impactante`,
  },
};

/**
 * Returns the locale configuration for the given code.
 * Falls back to English ('en') if the locale is not registered.
 */
export function getLocaleConfig(locale: string): LocaleConfig {
  return locales[locale] ?? locales.en;
}
