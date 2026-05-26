// Curated pool of well-known Bible verses used for the "Verse of the Day" feature.
// Day-of-year (UTC) modulo the pool length gives the daily verse — same verse all day, unique per day.
//
// bookSlug   → English routing slug (matches /public/bible-data/en/kjv/)
// bookSlugEs → Spanish routing slug (matches /public/bible-data/es/rv1909/)

export interface DailyVerse {
  /** Display reference in English, e.g. "John 3:16" */
  reference: string
  /** Display reference in Spanish, e.g. "Juan 3:16" */
  referenceEs: string
  /** Book slug used by the English (KJV) router */
  bookSlug: string
  /** Book slug used by the Spanish (RV1909) router */
  bookSlugEs: string
  /** Chapter number */
  chapter: number
  /** Verse number within the chapter */
  verse: number
}

export const DAILY_VERSES: DailyVerse[] = [
  { reference: 'John 3:16',            referenceEs: 'Juan 3:16',             bookSlug: 'john',           bookSlugEs: 'juan',                chapter: 3,   verse: 16 },
  { reference: 'Psalm 23:1',           referenceEs: 'Salmos 23:1',           bookSlug: 'psalms',         bookSlugEs: 'salmos',              chapter: 23,  verse: 1  },
  { reference: 'Romans 8:28',          referenceEs: 'Romanos 8:28',          bookSlug: 'romans',         bookSlugEs: 'romanos',             chapter: 8,   verse: 28 },
  { reference: 'Proverbs 3:5',         referenceEs: 'Proverbios 3:5',        bookSlug: 'proverbs',       bookSlugEs: 'proverbios',          chapter: 3,   verse: 5  },
  { reference: 'Isaiah 40:31',         referenceEs: 'Isaías 40:31',          bookSlug: 'isaiah',         bookSlugEs: 'isaias',              chapter: 40,  verse: 31 },
  { reference: 'Philippians 4:13',     referenceEs: 'Filipenses 4:13',       bookSlug: 'philippians',    bookSlugEs: 'filipenses',          chapter: 4,   verse: 13 },
  { reference: 'Jeremiah 29:11',       referenceEs: 'Jeremías 29:11',        bookSlug: 'jeremiah',       bookSlugEs: 'jeremias',            chapter: 29,  verse: 11 },
  { reference: 'Matthew 5:3',          referenceEs: 'Mateo 5:3',             bookSlug: 'matthew',        bookSlugEs: 'mateo',               chapter: 5,   verse: 3  },
  { reference: 'Psalm 46:1',           referenceEs: 'Salmos 46:1',           bookSlug: 'psalms',         bookSlugEs: 'salmos',              chapter: 46,  verse: 1  },
  { reference: 'Romans 12:2',          referenceEs: 'Romanos 12:2',          bookSlug: 'romans',         bookSlugEs: 'romanos',             chapter: 12,  verse: 2  },
  { reference: 'Joshua 1:9',           referenceEs: 'Josué 1:9',             bookSlug: 'joshua',         bookSlugEs: 'josue',               chapter: 1,   verse: 9  },
  { reference: 'Psalm 118:24',         referenceEs: 'Salmos 118:24',         bookSlug: 'psalms',         bookSlugEs: 'salmos',              chapter: 118, verse: 24 },
  { reference: 'John 14:6',            referenceEs: 'Juan 14:6',             bookSlug: 'john',           bookSlugEs: 'juan',                chapter: 14,  verse: 6  },
  { reference: 'Galatians 5:22',       referenceEs: 'Gálatas 5:22',          bookSlug: 'galatians',      bookSlugEs: 'galatas',             chapter: 5,   verse: 22 },
  { reference: '1 Corinthians 13:4',   referenceEs: '1 Corintios 13:4',      bookSlug: '1-corinthians',  bookSlugEs: '1-corintios',         chapter: 13,  verse: 4  },
  { reference: 'Matthew 6:33',         referenceEs: 'Mateo 6:33',            bookSlug: 'matthew',        bookSlugEs: 'mateo',               chapter: 6,   verse: 33 },
  { reference: 'Psalm 27:1',           referenceEs: 'Salmos 27:1',           bookSlug: 'psalms',         bookSlugEs: 'salmos',              chapter: 27,  verse: 1  },
  { reference: 'Philippians 4:6',      referenceEs: 'Filipenses 4:6',        bookSlug: 'philippians',    bookSlugEs: 'filipenses',          chapter: 4,   verse: 6  },
  { reference: 'Hebrews 11:1',         referenceEs: 'Hebreos 11:1',          bookSlug: 'hebrews',        bookSlugEs: 'hebreos',             chapter: 11,  verse: 1  },
  { reference: 'Romans 5:8',           referenceEs: 'Romanos 5:8',           bookSlug: 'romans',         bookSlugEs: 'romanos',             chapter: 5,   verse: 8  },
  { reference: 'Psalm 37:4',           referenceEs: 'Salmos 37:4',           bookSlug: 'psalms',         bookSlugEs: 'salmos',              chapter: 37,  verse: 4  },
  { reference: 'Isaiah 41:10',         referenceEs: 'Isaías 41:10',          bookSlug: 'isaiah',         bookSlugEs: 'isaias',              chapter: 41,  verse: 10 },
  { reference: 'John 11:25',           referenceEs: 'Juan 11:25',            bookSlug: 'john',           bookSlugEs: 'juan',                chapter: 11,  verse: 25 },
  { reference: 'Matthew 11:28',        referenceEs: 'Mateo 11:28',           bookSlug: 'matthew',        bookSlugEs: 'mateo',               chapter: 11,  verse: 28 },
  { reference: 'Psalm 91:1',           referenceEs: 'Salmos 91:1',           bookSlug: 'psalms',         bookSlugEs: 'salmos',              chapter: 91,  verse: 1  },
  { reference: 'Romans 8:38',          referenceEs: 'Romanos 8:38',          bookSlug: 'romans',         bookSlugEs: 'romanos',             chapter: 8,   verse: 38 },
  { reference: 'James 1:5',            referenceEs: 'Santiago 1:5',          bookSlug: 'james',          bookSlugEs: 'santiago',            chapter: 1,   verse: 5  },
  { reference: 'Psalm 19:14',          referenceEs: 'Salmos 19:14',          bookSlug: 'psalms',         bookSlugEs: 'salmos',              chapter: 19,  verse: 14 },
  { reference: 'Ephesians 2:8',        referenceEs: 'Efesios 2:8',           bookSlug: 'ephesians',      bookSlugEs: 'efesios',             chapter: 2,   verse: 8  },
  { reference: 'John 10:10',           referenceEs: 'Juan 10:10',            bookSlug: 'john',           bookSlugEs: 'juan',                chapter: 10,  verse: 10 },
  { reference: 'Proverbs 22:6',        referenceEs: 'Proverbios 22:6',       bookSlug: 'proverbs',       bookSlugEs: 'proverbios',          chapter: 22,  verse: 6  },
  { reference: '2 Timothy 3:16',       referenceEs: '2 Timoteo 3:16',        bookSlug: '2-timothy',      bookSlugEs: '2-timoteo',           chapter: 3,   verse: 16 },
  { reference: 'John 1:1',             referenceEs: 'Juan 1:1',              bookSlug: 'john',           bookSlugEs: 'juan',                chapter: 1,   verse: 1  },
  { reference: 'Psalm 121:1',          referenceEs: 'Salmos 121:1',          bookSlug: 'psalms',         bookSlugEs: 'salmos',              chapter: 121, verse: 1  },
  { reference: 'Genesis 1:1',          referenceEs: 'Génesis 1:1',           bookSlug: 'genesis',        bookSlugEs: 'genesis',             chapter: 1,   verse: 1  },
  { reference: 'Micah 6:8',            referenceEs: 'Miqueas 6:8',           bookSlug: 'micah',          bookSlugEs: 'miqueas',             chapter: 6,   verse: 8  },
  { reference: 'Lamentations 3:22',    referenceEs: 'Lamentaciones 3:22',    bookSlug: 'lamentations',   bookSlugEs: 'lamentaciones',       chapter: 3,   verse: 22 },
  { reference: 'Luke 6:31',            referenceEs: 'Lucas 6:31',            bookSlug: 'luke',           bookSlugEs: 'lucas',               chapter: 6,   verse: 31 },
  { reference: 'Colossians 3:23',      referenceEs: 'Colosenses 3:23',       bookSlug: 'colossians',     bookSlugEs: 'colosenses',          chapter: 3,   verse: 23 },
  { reference: 'Revelation 21:4',      referenceEs: 'Revelación 21:4',       bookSlug: 'revelation',     bookSlugEs: 'revelacion',          chapter: 21,  verse: 4  },
  { reference: '1 John 4:8',           referenceEs: '1 Juan 4:8',            bookSlug: '1-john',         bookSlugEs: '1-juan',              chapter: 4,   verse: 8  },
  { reference: 'Psalm 34:8',           referenceEs: 'Salmos 34:8',           bookSlug: 'psalms',         bookSlugEs: 'salmos',              chapter: 34,  verse: 8  },
  { reference: 'Matthew 28:19',        referenceEs: 'Mateo 28:19',           bookSlug: 'matthew',        bookSlugEs: 'mateo',               chapter: 28,  verse: 19 },
  { reference: 'Isaiah 53:5',          referenceEs: 'Isaías 53:5',           bookSlug: 'isaiah',         bookSlugEs: 'isaias',              chapter: 53,  verse: 5  },
  { reference: 'Luke 1:37',            referenceEs: 'Lucas 1:37',            bookSlug: 'luke',           bookSlugEs: 'lucas',               chapter: 1,   verse: 37 },
  { reference: 'Psalm 150:6',          referenceEs: 'Salmos 150:6',          bookSlug: 'psalms',         bookSlugEs: 'salmos',              chapter: 150, verse: 6  },
  { reference: 'Acts 1:8',             referenceEs: 'Hechos 1:8',            bookSlug: 'acts',           bookSlugEs: 'hechos',              chapter: 1,   verse: 8  },
  { reference: 'James 4:7',            referenceEs: 'Santiago 4:7',          bookSlug: 'james',          bookSlugEs: 'santiago',            chapter: 4,   verse: 7  },
  { reference: 'Psalm 139:14',         referenceEs: 'Salmos 139:14',         bookSlug: 'psalms',         bookSlugEs: 'salmos',              chapter: 139, verse: 14 },
  { reference: 'Mark 12:30',           referenceEs: 'Marcos 12:30',          bookSlug: 'mark',           bookSlugEs: 'marcos',              chapter: 12,  verse: 30 },
  { reference: 'Proverbs 31:25',       referenceEs: 'Proverbios 31:25',      bookSlug: 'proverbs',       bookSlugEs: 'proverbios',          chapter: 31,  verse: 25 },
  { reference: 'Deuteronomy 31:8',     referenceEs: 'Deuteronomio 31:8',     bookSlug: 'deuteronomy',    bookSlugEs: 'deuteronomio',        chapter: 31,  verse: 8  },
  { reference: '2 Corinthians 5:17',   referenceEs: '2 Corintios 5:17',      bookSlug: '2-corinthians',  bookSlugEs: '2-corintios',         chapter: 5,   verse: 17 },
  { reference: 'Nehemiah 8:10',        referenceEs: 'Nehemías 8:10',         bookSlug: 'nehemiah',       bookSlugEs: 'nehemias',            chapter: 8,   verse: 10 },
  { reference: 'Psalm 1:1',            referenceEs: 'Salmos 1:1',            bookSlug: 'psalms',         bookSlugEs: 'salmos',              chapter: 1,   verse: 1  },
  { reference: 'John 16:33',           referenceEs: 'Juan 16:33',            bookSlug: 'john',           bookSlugEs: 'juan',                chapter: 16,  verse: 33 },
  { reference: 'Numbers 6:24',         referenceEs: 'Números 6:24',          bookSlug: 'numbers',        bookSlugEs: 'numeros',             chapter: 6,   verse: 24 },
  { reference: 'Habakkuk 3:17',        referenceEs: 'Habacuc 3:17',          bookSlug: 'habakkuk',       bookSlugEs: 'habacuc',             chapter: 3,   verse: 17 },
  { reference: 'Ezekiel 36:26',        referenceEs: 'Ezequiel 36:26',        bookSlug: 'ezekiel',        bookSlugEs: 'ezequiel',            chapter: 36,  verse: 26 },
  { reference: 'Romans 1:16',          referenceEs: 'Romanos 1:16',          bookSlug: 'romans',         bookSlugEs: 'romanos',             chapter: 1,   verse: 16 },
  { reference: 'Psalm 16:8',           referenceEs: 'Salmos 16:8',           bookSlug: 'psalms',         bookSlugEs: 'salmos',              chapter: 16,  verse: 8  },
  { reference: 'Luke 11:9',            referenceEs: 'Lucas 11:9',            bookSlug: 'luke',           bookSlugEs: 'lucas',               chapter: 11,  verse: 9  },
  { reference: '1 Peter 5:7',          referenceEs: '1 Pedro 5:7',           bookSlug: '1-peter',        bookSlugEs: '1-pedro',             chapter: 5,   verse: 7  },
  { reference: 'Isaiah 26:3',          referenceEs: 'Isaías 26:3',           bookSlug: 'isaiah',         bookSlugEs: 'isaias',              chapter: 26,  verse: 3  },
  { reference: 'Psalm 55:22',          referenceEs: 'Salmos 55:22',          bookSlug: 'psalms',         bookSlugEs: 'salmos',              chapter: 55,  verse: 22 },
  { reference: 'Matthew 5:16',         referenceEs: 'Mateo 5:16',            bookSlug: 'matthew',        bookSlugEs: 'mateo',               chapter: 5,   verse: 16 },
  { reference: 'Psalm 145:18',         referenceEs: 'Salmos 145:18',         bookSlug: 'psalms',         bookSlugEs: 'salmos',              chapter: 145, verse: 18 },
  { reference: 'Ephesians 6:10',       referenceEs: 'Efesios 6:10',          bookSlug: 'ephesians',      bookSlugEs: 'efesios',             chapter: 6,   verse: 10 },
  { reference: 'Romans 15:13',         referenceEs: 'Romanos 15:13',         bookSlug: 'romans',         bookSlugEs: 'romanos',             chapter: 15,  verse: 13 },
  { reference: 'John 8:32',            referenceEs: 'Juan 8:32',             bookSlug: 'john',           bookSlugEs: 'juan',                chapter: 8,   verse: 32 },
  { reference: '1 John 1:9',           referenceEs: '1 Juan 1:9',            bookSlug: '1-john',         bookSlugEs: '1-juan',              chapter: 1,   verse: 9  },
  { reference: 'Psalm 103:12',         referenceEs: 'Salmos 103:12',         bookSlug: 'psalms',         bookSlugEs: 'salmos',              chapter: 103, verse: 12 },
  { reference: 'Matthew 22:37',        referenceEs: 'Mateo 22:37',           bookSlug: 'matthew',        bookSlugEs: 'mateo',               chapter: 22,  verse: 37 },
  { reference: 'Psalm 73:26',          referenceEs: 'Salmos 73:26',          bookSlug: 'psalms',         bookSlugEs: 'salmos',              chapter: 73,  verse: 26 },
  { reference: 'Proverbs 16:3',        referenceEs: 'Proverbios 16:3',       bookSlug: 'proverbs',       bookSlugEs: 'proverbios',          chapter: 16,  verse: 3  },
  { reference: 'Isaiah 43:2',          referenceEs: 'Isaías 43:2',           bookSlug: 'isaiah',         bookSlugEs: 'isaias',              chapter: 43,  verse: 2  },
  { reference: 'Psalm 62:1',           referenceEs: 'Salmos 62:1',           bookSlug: 'psalms',         bookSlugEs: 'salmos',              chapter: 62,  verse: 1  },
  { reference: '2 Chronicles 7:14',    referenceEs: '2 Crónicas 7:14',       bookSlug: '2-chronicles',   bookSlugEs: '2-cronicas',          chapter: 7,   verse: 14 },
  { reference: 'Zephaniah 3:17',       referenceEs: 'Sofonías 3:17',         bookSlug: 'zephaniah',      bookSlugEs: 'sofonias',            chapter: 3,   verse: 17 },
  { reference: 'Psalm 42:1',           referenceEs: 'Salmos 42:1',           bookSlug: 'psalms',         bookSlugEs: 'salmos',              chapter: 42,  verse: 1  },
  { reference: 'Romans 8:1',           referenceEs: 'Romanos 8:1',           bookSlug: 'romans',         bookSlugEs: 'romanos',             chapter: 8,   verse: 1  },
  { reference: 'John 15:5',            referenceEs: 'Juan 15:5',             bookSlug: 'john',           bookSlugEs: 'juan',                chapter: 15,  verse: 5  },
  { reference: 'Proverbs 18:10',       referenceEs: 'Proverbios 18:10',      bookSlug: 'proverbs',       bookSlugEs: 'proverbios',          chapter: 18,  verse: 10 },
  { reference: 'Isaiah 55:11',         referenceEs: 'Isaías 55:11',          bookSlug: 'isaiah',         bookSlugEs: 'isaias',              chapter: 55,  verse: 11 },
  { reference: 'Psalm 32:8',           referenceEs: 'Salmos 32:8',           bookSlug: 'psalms',         bookSlugEs: 'salmos',              chapter: 32,  verse: 8  },
  { reference: 'Matthew 7:7',          referenceEs: 'Mateo 7:7',             bookSlug: 'matthew',        bookSlugEs: 'mateo',               chapter: 7,   verse: 7  },
  { reference: 'Psalm 119:105',        referenceEs: 'Salmos 119:105',        bookSlug: 'psalms',         bookSlugEs: 'salmos',              chapter: 119, verse: 105 },
  { reference: 'Ephesians 4:32',       referenceEs: 'Efesios 4:32',          bookSlug: 'ephesians',      bookSlugEs: 'efesios',             chapter: 4,   verse: 32 },
  { reference: 'Romans 12:12',         referenceEs: 'Romanos 12:12',         bookSlug: 'romans',         bookSlugEs: 'romanos',             chapter: 12,  verse: 12 },
  { reference: 'John 4:24',            referenceEs: 'Juan 4:24',             bookSlug: 'john',           bookSlugEs: 'juan',                chapter: 4,   verse: 24 },
  { reference: 'Psalm 100:4',          referenceEs: 'Salmos 100:4',          bookSlug: 'psalms',         bookSlugEs: 'salmos',              chapter: 100, verse: 4  },
  { reference: 'Proverbs 4:23',        referenceEs: 'Proverbios 4:23',       bookSlug: 'proverbs',       bookSlugEs: 'proverbios',          chapter: 4,   verse: 23 },
  { reference: 'Isaiah 9:6',           referenceEs: 'Isaías 9:6',            bookSlug: 'isaiah',         bookSlugEs: 'isaias',              chapter: 9,   verse: 6  },
  { reference: 'Psalm 51:10',          referenceEs: 'Salmos 51:10',          bookSlug: 'psalms',         bookSlugEs: 'salmos',              chapter: 51,  verse: 10 },
  { reference: 'Luke 15:7',            referenceEs: 'Lucas 15:7',            bookSlug: 'luke',           bookSlugEs: 'lucas',               chapter: 15,  verse: 7  },
  { reference: 'Psalm 28:7',           referenceEs: 'Salmos 28:7',           bookSlug: 'psalms',         bookSlugEs: 'salmos',              chapter: 28,  verse: 7  },
  { reference: 'Ezekiel 36:26',        referenceEs: 'Ezequiel 36:26',        bookSlug: 'ezekiel',        bookSlugEs: 'ezequiel',            chapter: 36,  verse: 26 },
  { reference: 'Matthew 5:9',          referenceEs: 'Mateo 5:9',             bookSlug: 'matthew',        bookSlugEs: 'mateo',               chapter: 5,   verse: 9  },
  { reference: 'Psalm 29:11',          referenceEs: 'Salmos 29:11',          bookSlug: 'psalms',         bookSlugEs: 'salmos',              chapter: 29,  verse: 11 },
  { reference: 'Revelation 3:20',      referenceEs: 'Revelación 3:20',       bookSlug: 'revelation',     bookSlugEs: 'revelacion',          chapter: 3,   verse: 20 },
  { reference: 'Psalm 4:8',            referenceEs: 'Salmos 4:8',            bookSlug: 'psalms',         bookSlugEs: 'salmos',              chapter: 4,   verse: 8  },
  { reference: 'Galatians 6:9',        referenceEs: 'Gálatas 6:9',           bookSlug: 'galatians',      bookSlugEs: 'galatas',             chapter: 6,   verse: 9  },
  { reference: 'Psalm 86:15',          referenceEs: 'Salmos 86:15',          bookSlug: 'psalms',         bookSlugEs: 'salmos',              chapter: 86,  verse: 15 },
  { reference: 'John 13:34',           referenceEs: 'Juan 13:34',            bookSlug: 'john',           bookSlugEs: 'juan',                chapter: 13,  verse: 34 },
  { reference: 'Psalm 147:3',          referenceEs: 'Salmos 147:3',          bookSlug: 'psalms',         bookSlugEs: 'salmos',              chapter: 147, verse: 3  },
  { reference: 'Romans 10:9',          referenceEs: 'Romanos 10:9',          bookSlug: 'romans',         bookSlugEs: 'romanos',             chapter: 10,  verse: 9  },
  { reference: 'Proverbs 17:17',       referenceEs: 'Proverbios 17:17',      bookSlug: 'proverbs',       bookSlugEs: 'proverbios',          chapter: 17,  verse: 17 },
  { reference: 'Matthew 6:34',         referenceEs: 'Mateo 6:34',            bookSlug: 'matthew',        bookSlugEs: 'mateo',               chapter: 6,   verse: 34 },
  { reference: 'Psalm 107:1',          referenceEs: 'Salmos 107:1',          bookSlug: 'psalms',         bookSlugEs: 'salmos',              chapter: 107, verse: 1  },
  { reference: '1 Thessalonians 5:16', referenceEs: '1 Tesalonicenses 5:16', bookSlug: '1-thessalonians',bookSlugEs: '1-tesalonicenses',    chapter: 5,   verse: 16 },
  { reference: 'Psalm 30:5',           referenceEs: 'Salmos 30:5',           bookSlug: 'psalms',         bookSlugEs: 'salmos',              chapter: 30,  verse: 5  },
  { reference: 'John 6:35',            referenceEs: 'Juan 6:35',             bookSlug: 'john',           bookSlugEs: 'juan',                chapter: 6,   verse: 35 },
  { reference: 'Isaiah 43:19',         referenceEs: 'Isaías 43:19',          bookSlug: 'isaiah',         bookSlugEs: 'isaias',              chapter: 43,  verse: 19 },
  { reference: 'Psalm 56:3',           referenceEs: 'Salmos 56:3',           bookSlug: 'psalms',         bookSlugEs: 'salmos',              chapter: 56,  verse: 3  },
]

/**
 * Returns the verse for today based on the current local date.
 * The same verse is shown for the entire calendar day.
 */
export function getVerseOfTheDay(): DailyVerse {
  const now = new Date()
  // Combine year + day-of-year into a stable daily seed
  const start = new Date(now.getFullYear(), 0, 0)
  const diff = now.getTime() - start.getTime()
  const oneDay = 1000 * 60 * 60 * 24
  const dayOfYear = Math.floor(diff / oneDay)
  return DAILY_VERSES[dayOfYear % DAILY_VERSES.length]
}
