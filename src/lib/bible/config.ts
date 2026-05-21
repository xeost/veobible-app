// Registry of all supported Bible versions
// Each entry maps a language + version slug to its data path

export interface BibleVersion {
  langCode: string
  slug: string
  dataPath: string       // relative path under material/bible-versions/
  publicPath: string     // relative path under public/bible-data/
  name: string
  shortName: string
}

export const BIBLE_VERSIONS: BibleVersion[] = [
  {
    langCode: 'en',
    slug: 'kjv',
    dataPath: 'en/kjv',
    publicPath: 'en/kjv',
    name: 'King James Version',
    shortName: 'KJV',
  },
  {
    langCode: 'es',
    slug: 'rv-1909',
    dataPath: 'es/rv-1909',
    publicPath: 'es/rv-1909',
    name: 'Reina Valera 1909',
    shortName: 'RV-1909',
  },
]

// Versions available per language
export function getVersionsForLang(langCode: string): BibleVersion[] {
  return BIBLE_VERSIONS.filter((v) => v.langCode === langCode)
}

// Get default version for a language (first one)
export function getDefaultVersionForLang(langCode: string): BibleVersion | undefined {
  return getVersionsForLang(langCode)[0]
}

export function findVersion(langCode: string, versionSlug: string): BibleVersion | undefined {
  return BIBLE_VERSIONS.find((v) => v.langCode === langCode && v.slug === versionSlug)
}
