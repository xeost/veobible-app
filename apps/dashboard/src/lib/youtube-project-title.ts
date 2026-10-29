import { catalog } from "../../../../packages/website/content";
import {
  episodeReference,
  type EpisodeChapterRange,
} from "../../../../tools/video-project-api/src/episode-reference";
import { publicationTitle } from "../../../../tools/video-project-api/src/publication";
import {
  fillPublicationTemplate,
  publicationTemplateSections,
} from "../../../../tools/video-project-api/src/publication-templates";
import { normalizeTitle } from "./website";
import type { PendingProject } from "./website-youtube";

/** Recreate the title section with the same values used when generating the video. */
export function youtubeProjectTitle(
  p: PendingProject,
  template: string,
): string | null {
  const sections = publicationTemplateSections(template);
  const section =
    sections.find((s) =>
      ["title", "titulo"].includes(normalizeTitle(s.heading)),
    ) ??
    (sections.length === 1 && !sections[0].heading ? sections[0] : undefined);
  const titleTemplate = section?.heading
    ? section.template.trim()
    : section?.template
        .trim()
        .split(/\r?\n/)
        .find((line) => line.trim());
  // These values require verse text and are intended for the description. Do not
  // turn them into wildcards that could match an unrelated video.
  if (!titleTemplate || /\{(?:passage|hashtags)\}/.test(titleTemplate))
    return null;
  const locale = p.locale;
  if (locale !== "es" && locale !== "en" && locale !== "pt") return null;
  const version = (catalog as Record<string, (typeof catalog)["es/rv1909"]>)[
    `${locale}/${p.version}`
  ];
  if (!version) return null;
  let passage: any;
  try {
    passage = JSON.parse(p.passage);
  } catch {
    return null;
  }
  if (!passage || typeof passage !== "object") return null;
  let reference = p.title;
  const first = version.books.findIndex(
    (book) => book.id === passage.book || book.slug === passage.book,
  );
  const last = version.books.findIndex(
    (book) =>
      book.id === (passage.endBook ?? passage.book) ||
      book.slug === (passage.endBook ?? passage.book),
  );
  if (first >= 0 && last >= first && passage.start && passage.end) {
    const ranges: EpisodeChapterRange[] = [];
    for (let i = first; i <= last; i++) {
      const book = version.books[i];
      const start = i === first ? passage.start.chapter : 1;
      const end = i === last ? passage.end.chapter : book.chapters;
      if (
        !Number.isInteger(start) ||
        !Number.isInteger(end) ||
        start < 1 ||
        end > book.chapters ||
        start > end
      )
        return null;
      for (let chapter = start; chapter <= end; chapter++) {
        const a = i === first && chapter === start ? passage.start.verse : 1;
        const b =
          i === last && chapter === end
            ? passage.end.verse
            : book.versesPerChapter[chapter - 1];
        if (
          !Number.isInteger(a) ||
          !Number.isInteger(b) ||
          a < 1 ||
          b > book.versesPerChapter[chapter - 1] ||
          a > b
        )
          return null;
        ranges.push({ book, chapter, first: a, last: b });
      }
    }
    if (p.kind === "short") {
      if (first !== last) return null;
      const a = passage.start,
        b = passage.end;
      reference = `${version.books[first].name} ${a.chapter}:${a.verse}${a.chapter === b.chapter && a.verse === b.verse ? "" : a.chapter === b.chapter ? `-${b.verse}` : `-${b.chapter}:${b.verse}`}`;
    } else {
      reference = episodeReference(ranges, locale, String).display;
    }
  } else if (p.kind === "book" && first >= 0) {
    reference = version.books[first].name;
  }
  const values = publicationTitle(
    locale,
    reference,
    version.name,
    p.kind,
    passage.episode,
  );
  const passageUrl =
    first >= 0 && passage.start
      ? `https://veobible.com/${locale}/${p.version}/${passage.book}/${passage.start.chapter}${passage.start.verse === 1 ? "" : `#${passage.start.verse}`}`
      : "";
  if (
    /\{episode\}/.test(titleTemplate) &&
    (p.kind !== "long" ||
      !Number.isInteger(passage.episode) ||
      passage.episode < 1)
  )
    return null;
  if (/\{passage_url\}/.test(titleTemplate) && !passageUrl) return null;
  const title = fillPublicationTemplate(titleTemplate, {
    title: values.title,
    reference: values.reference,
    version: values.version,
    episode: values.episode === undefined ? "" : String(values.episode),
    passage: "",
    passage_url: passageUrl,
    hashtags: "",
  }).trim();
  return normalizeTitle(title) ? title : null;
}
