import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { publicationDescriptions } from "./publication.js";
import {
  fillPublicationTemplate,
  publicationPlatforms,
  publicationTemplatesSchema,
  type PublicationTemplates,
} from "./publication-templates.js";

test("documented settings reproduce previous captions in all three languages and include Facebook", async () => {
  const baseline = JSON.parse(
    await fs.readFile(
      new URL("./test-fixtures/publication-before.json", import.meta.url),
      "utf8",
    ),
  );
  const document = await fs.readFile(
    new URL("../../../docs/publication-template-values.md", import.meta.url),
    "utf8",
  );
  const formats = document.split(/\n## Videos (?:cortos|largos)\n/).slice(1);
  for (const [index, kind] of (["short", "long"] as const).entries()) {
    const languages = formats[index]
      .split(/\n### (?:Inglés|Español|Portugués)\n/)
      .slice(1);
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
      const result = publicationDescriptions(
        locale,
        baseline.title,
        baseline.verses,
        templates,
        kind,
      );
      assert.equal(result["facebook.txt"], result["youtube.txt"]);
      delete result["facebook.txt"];
      assert.deepEqual(result, baseline.expected[kind][locale]);
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
      "youtube.txt": "Title\n\nJohn 1:1 — Bible\nLiteral {title} text\n",
    },
  );
  assert.deepEqual(publicationDescriptions("es", title, [], {}, "short"), {});
  assert.throws(() =>
    fillPublicationTemplate("{unknown}", {
      title: "",
      reference: "",
      version: "",
      passage: "",
      hashtags: "",
    }),
  );
});
