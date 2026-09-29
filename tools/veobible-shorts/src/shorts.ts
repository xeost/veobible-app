import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config, type Version } from "./config.js";

export interface Point { chapter: number; verse: number }
export interface Passage { id: string; book: string; start: Point; end: Point }
interface Book { id: string; name: string; chapters: number; versesPerChapter: number[] }
interface BibleIndex { metadata: { name: string }; books: Book[] }
interface Verse { verse: number; text: string }
export interface UsedRecord { usedAt: string; locale: string; version: string; output: string }
export type Status = Record<string, UsedRecord>;

const catalogPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../popular-verses.json");
const safeId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function assertPoint(value: unknown, label: string): asserts value is Point {
  if (!value || typeof value !== "object") throw new Error(`${label}: capítulo y versículo requeridos`);
  const point = value as Point;
  if (!Number.isSafeInteger(point.chapter) || point.chapter < 1 || !Number.isSafeInteger(point.verse) || point.verse < 1) {
    throw new Error(`${label}: capítulo y versículo deben ser enteros positivos`);
  }
}

export async function loadCatalog(): Promise<Passage[]> {
  const raw: unknown = JSON.parse(await fs.readFile(catalogPath, "utf8"));
  if (!Array.isArray(raw) || raw.length === 0) throw new Error("El catálogo debe ser una lista no vacía");
  const ids = new Set<string>();
  return raw.map((entry: unknown, index) => {
    if (!entry || typeof entry !== "object") throw new Error(`Entrada ${index + 1} inválida`);
    const passage = entry as Passage;
    if (!safeId.test(passage.id) || !safeId.test(passage.book) || ids.has(passage.id)) throw new Error(`ID o libro inválido/repetido en entrada ${index + 1}`);
    ids.add(passage.id);
    assertPoint(passage.start, `${passage.id}.start`);
    assertPoint(passage.end, `${passage.id}.end`);
    if (passage.start.chapter > passage.end.chapter || (passage.start.chapter === passage.end.chapter && passage.start.verse > passage.end.verse)) {
      throw new Error(`Rango invertido: ${passage.id}`);
    }
    return passage;
  });
}

export function reference(bookName: string, passage: Passage): string {
  const a = passage.start, b = passage.end;
  return `${bookName} ${a.chapter}:${a.verse}${a.chapter === b.chapter && a.verse === b.verse ? "" : a.chapter === b.chapter ? `-${b.verse}` : `-${b.chapter}:${b.verse}`}`;
}

export async function readIndex(version: Version): Promise<BibleIndex> {
  return JSON.parse(await fs.readFile(path.join(config.bibleDataDir, version.locale, version.id, "index.json"), "utf8")) as BibleIndex;
}

export function getBook(index: BibleIndex, passage: Passage): { book: Book; number: number } {
  const number = index.books.findIndex(book => book.id === passage.book) + 1;
  if (!number) throw new Error(`Libro ${passage.book} no disponible en esta versión`);
  const book = index.books[number - 1];
  for (const point of [passage.start, passage.end]) {
    if (point.chapter > book.chapters || point.verse > (book.versesPerChapter[point.chapter - 1] ?? 0)) {
      throw new Error(`Versículo fuera de rango: ${reference(book.name, passage)}`);
    }
  }
  return { book, number };
}

async function versesForChapter(version: Version, book: Book, chapter: number): Promise<Verse[]> {
  const root = path.join(config.bibleDataDir, version.locale, version.id);
  const file = path.join(root, book.id, `${chapter}.json`);
  const parsed: unknown = JSON.parse(await fs.readFile(file, "utf8"));
  if (!Array.isArray(parsed) || !parsed.every(item => item && Number.isSafeInteger(item.verse) && typeof item.text === "string")) {
    throw new Error(`Formato de versículos inválido: ${file}`);
  }
  return parsed as Verse[];
}

async function chapterAudio(version: Version, book: Book, number: number, chapter: number): Promise<string> {
  const prefix = `${String(number).padStart(2, "0")}-${book.id}-${chapter}`;
  for (const ext of [".mp3", ".m4a", ".MP3", ".M4A"]) {
    const candidate = path.join(config.audioDir, version.id, prefix + ext);
    try { if ((await fs.stat(candidate)).isFile()) return candidate; } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  throw new Error(`Falta el audio del capítulo ${chapter}: ${path.join(config.audioDir, version.id, prefix)}.{mp3,m4a}`);
}

export async function prepareShort(version: Version, passage: Passage): Promise<string> {
  const index = await readIndex(version);
  const { book, number } = getBook(index, passage);
  const label = reference(book.name, passage);
  const lines: string[] = [];
  const audios: { chapter: number; source: string }[] = [];
  for (let chapter = passage.start.chapter; chapter <= passage.end.chapter; chapter++) {
    const first = chapter === passage.start.chapter ? passage.start.verse : 1;
    const last = chapter === passage.end.chapter ? passage.end.verse : book.versesPerChapter[chapter - 1];
    const all = await versesForChapter(version, book, chapter);
    const selected = all.filter(v => v.verse >= first && v.verse <= last);
    if (selected.length !== last - first + 1 || selected.some((v, i) => v.verse !== first + i)) throw new Error(`Faltan versículos de ${book.name} ${chapter}:${first}-${last}`);
    lines.push(...selected.map(v => `${chapter}:${v.verse} ${v.text}`));
    audios.push({ chapter, source: await chapterAudio(version, book, number, chapter) });
  }

  const destination = path.join(config.outputDir, version.id, passage.id);
  try { await fs.access(destination); throw new Error(`La salida ya existe: ${destination}`); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const temp = await fs.mkdtemp(path.join(path.dirname(destination), `.short-${passage.id}-`));
  try {
    const filenames: string[] = [];
    for (const { chapter, source } of audios) {
      const filename = `${String(number).padStart(2, "0")}-${book.id}-${chapter}${path.extname(source)}`;
      await fs.copyFile(source, path.join(temp, filename));
      filenames.push(filename);
    }
    await fs.writeFile(path.join(temp, "versiculos.txt"), `${label} — ${index.metadata.name}\n\n${lines.join("\n")}\n`, "utf8");
    await fs.writeFile(path.join(temp, "metadata.txt"), [
      `Referencia: ${label}`,
      `ID del rango: ${passage.id}`,
      `Idioma: ${version.locale}`,
      `Versión: ${index.metadata.name} (${version.id})`,
      `Libro: ${book.name} (${book.id})`,
      `Inicio: ${passage.start.chapter}:${passage.start.verse}`,
      `Fin: ${passage.end.chapter}:${passage.end.verse}`,
      `Audio: capítulos completos, sin recorte por versículo`,
      `Archivos de audio: ${filenames.join(", ")}`,
      `Texto: versiculos.txt`,
      ""
    ].join("\n"), "utf8");
    await fs.rename(temp, destination);
  } catch (error) {
    await fs.rm(temp, { recursive: true, force: true });
    throw error;
  }
  return destination;
}

const statusPath = () => path.join(config.outputDir, "status.json");

export async function readStatus(): Promise<Status> {
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(statusPath(), "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("status.json inválido");
    return parsed as Status;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

export async function markUsed(passage: Passage, version: Version, output: string): Promise<void> {
  const status = await readStatus();
  if (status[passage.id]) throw new Error(`El rango ${passage.id} ya está marcado como utilizado`);
  status[passage.id] = { usedAt: new Date().toISOString(), locale: version.locale, version: version.id, output };
  await fs.mkdir(config.outputDir, { recursive: true });
  const temp = path.join(config.outputDir, `.status-${process.pid}-${Date.now()}.json`);
  try {
    await fs.writeFile(temp, JSON.stringify(status, null, 2) + "\n", { encoding: "utf8", flag: "wx" });
    await fs.rename(temp, statusPath());
  } catch (error) {
    await fs.rm(temp, { force: true });
    throw error;
  }
}
