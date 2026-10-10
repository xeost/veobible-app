import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { thumbnailFilename } from "./output-files.js";
import {
  publicationDescriptions,
  publicationPassageUrl,
} from "./publication.js";
import {
  fillPublicationTemplate,
  publicationPlatforms,
  publicationTemplatesSchema,
  type PublicationTemplates,
} from "./publication-templates.js";

test("documented templates cover each platform and language with usable titles and passage links", async () => {
  const document = await fs.readFile(
    new URL("../../../docs/publication-template-values.md", import.meta.url),
    "utf8",
  );
  const formats = document.split(/\n## Videos (?:cortos|largos)\n/).slice(1);
  assert.equal(formats.length, 2);
  const title = {
    title: "VeoBible",
    episode: 7,
    reference: "John 3:16–17",
    version: "Test Bible",
  };
  for (const [index, kind] of (["short", "long"] as const).entries()) {
    const languages = formats[index]
      .split(/\n### (?:Inglés|Español|Portugués)\n/)
      .slice(1);
    assert.equal(languages.length, 3);
    for (const [i, locale] of (["en", "es", "pt"] as const).entries()) {
      const templates: PublicationTemplates = {};
      for (const block of languages[i].matchAll(
        /#### (\w+)\n\n```text\n([\s\S]*?)\n```/g,
      )) {
        templates[block[1].toLowerCase() as keyof PublicationTemplates] =
          block[2];
      }
      publicationTemplatesSchema.parse(templates);
      assert.deepEqual(Object.keys(templates), [...publicationPlatforms(kind)]);
      const url = `https://veobible.com/${locale}/test/john/3#16`;
      const result = publicationDescriptions(
        locale,
        title,
        ["Selected verse."],
        templates,
        kind,
        url,
      );
      assert.equal(Object.keys(result).length, publicationPlatforms(kind).length * (kind === "long" ? 2 : 1) + (kind === "short" ? 1 : 0));
      for (const [filename, text] of Object.entries(result)) {
        assert.ok(text.includes(title.reference));
        assert.doesNotMatch(text, /[{}]/);
        assert.doesNotMatch(text, /^#{1,6} /m);
        if (/^[2-5]\.1-/.test(filename)) {
          const longTitle = {
            en: "The Bible in 365 Days | Day 7",
            es: "La Biblia en 365 días | Día 7",
            pt: "A Bíblia em 365 dias | Dia 7",
          }[locale];
          const shortTitle = {
            en: "A moment with the Bible",
            es: "Un momento con la Biblia",
            pt: "Um momento com a Bíblia",
          }[locale];
          assert.equal(text.trim(), kind === "long"
            ? `${longTitle} | ${title.reference}`
            : `${title.reference} | ${shortTitle}`);
          assert.doesNotMatch(text, /\p{Extended_Pictographic}/u);
        } else {
          assert.ok(text.includes(title.version));
          if (kind === "long") assert.ok(text.includes(url));
        }
      }
    }
  }
});

test("custom publication copy preserves line breaks, omits empty templates, and substitutes values only once", () => {
  const title = { title: "Title", reference: "John 1:1", version: "Bible" };
  const templates = {
    youtube: "{title}\n\n{reference} — {version}\n{passage}",
    x: "\n  ",
    instagram: "Instagram",
  };
  assert.deepEqual(
    publicationDescriptions(
      "en",
      title,
      ["Literal {title} (H1-2)\n text"],
      templates,
      "long",
    ),
    {
      "3-youtube.txt": "Title\n\nJohn 1:1 — Bible\nLiteral {title} text\n",
    },
  );
  assert.deepEqual(publicationDescriptions("es", title, [], {}, "short"), {});
  assert.throws(() =>
    fillPublicationTemplate("{unknown}", {
      title: "",
      episode: "",
      reference: "",
      version: "",
      passage: "",
      passage_url: "",
      hashtags: "",
    }),
  );
});

test("publication links use the saved language, version, book and first verse, omitting verse 1", () => {
  for (const locale of ["en", "es", "pt"] as const) {
    const input = {
      version: { id: "rv1909", label: "Display name", locale },
      passage: {
        id: "episode-003",
        book: "genesis",
        endBook: "exodus",
        episode: 3,
        start: { chapter: 7, verse: 13 },
        end: { chapter: 2, verse: 8 },
      },
    };
    assert.equal(
      publicationPassageUrl(input),
      `https://veobible.com/${locale}/rv1909/genesis/7#13`,
    );
    input.passage.start.verse = 1;
    assert.equal(
      publicationPassageUrl(input),
      `https://veobible.com/${locale}/rv1909/genesis/7`,
    );
  }
});

test("episode placeholders use the saved day and remain empty when it is unavailable", () => {
  const title = {
    title: "Series",
    reference: "Genesis 3",
    version: "Bible",
    episode: 42,
  };
  const templates = {
    youtube:
      "# Title\n\nDay {episode} | {reference}\n\n# Description\n\n{version}",
  };
  const text = publicationDescriptions("en", title, [], templates, "long")[
    "3.1-youtube.txt"
  ];
  assert.ok(text.includes("Day 42 | Genesis 3"));
  assert.ok(
    publicationDescriptions(
      "en",
      { ...title, episode: undefined },
      [],
      { youtube: "[{episode}]" },
      "long",
    )["3-youtube.txt"].includes("[]"),
  );
  assert.equal(
    publicationDescriptions(
      "en",
      title,
      [],
      { youtube: "[{episode}]" },
      "short",
    )["3-youtube.txt"],
    "[]\n",
  );
});


test("book hashtags omit chapter and verse ranges, preserving numbered book names", () => {
  for (const kind of ["short", "long"] as const) {
    for (const [reference, expected] of [
      ["Mateo 1–4", "#Mateo"], ["Mateo capítulos 1 al 4", "#Mateo"],
      ["John chapters 1 to 4", "#John"], ["João 3:16–17", "#Joao"],
      ["1 Samuel 1–3", "#1Samuel"], ["Genesis 1–2 · Exodus 1", "#Genesis"],
    ]) {
      const text = publicationDescriptions("es", { title: "Title", reference, version: "Bible" }, [], { youtube: "{hashtags}" }, kind)["3-youtube.txt"];
      assert.ok(text.split(/\s+/).includes(expected), text);
      assert.doesNotMatch(text, /#(?:Mateo|John|Joao|Genesis)\d/);
    }
  }
});

test("headings split into numbered plain text files before placeholders are expanded", () => {
  const result = publicationDescriptions("en", { title: "A title", reference: "John 1", version: "Bible" }, ["# Not a template heading"], {
    youtube: "# Title\r\n{title}\r\n\r\n# Description\r\n{passage}\r\n\r\n## Extra\r\nMore text",
    facebook: "# Description\nFacebook copy",
  }, "short");
  assert.equal(thumbnailFilename(result), "3.4-thumbnail.jpg");
  assert.equal(thumbnailFilename({ "3-youtube.txt": "Copy" }), "3.1-thumbnail.jpg");
  assert.deepEqual(result, {
    "2.1-facebook.txt": "Facebook copy\n",
    "3.1-youtube.txt": "A title\n",
    "3.2-youtube.txt": "# Not a template heading\n",
    "3.3-youtube.txt": "More text\n",
  });
});
