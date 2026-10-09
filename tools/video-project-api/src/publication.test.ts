import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
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
      assert.equal(
        Object.keys(result).length,
        publicationPlatforms(kind).length,
      );
      for (const text of Object.values(result)) {
        assert.ok(text.includes(title.reference));
        assert.ok(text.includes(title.version));
        assert.doesNotMatch(text, /[{}]/);
        if (kind === "long") {
          const [headline, ...description] = text.trim().split("\n\n");
          assert.ok(headline.includes(title.reference));
          assert.ok(!headline.includes("\n"));
          assert.ok(!headline.includes("#"));
          assert.ok(description.join("\n\n").includes(url));
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
