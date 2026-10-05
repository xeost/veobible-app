import assert from "node:assert/strict";
import test from "node:test";
import { publicationDescriptions } from "./publication.js";
import { introTitle } from "./shorts.js";
import { introAnimationEnd } from "./remotion/animation.js";

import { introThumbnailTime } from "./video.js";

test("publication descriptions are localized and X includes the complete passage", () => {
  const cases = [
    { locale: "es", reference: "Juan 3:16-17", verses: ["3:16 Porque de tal manera amó Dios al mundo.", "3:17 Para que el mundo sea salvo por él."], follow: "Síguenos", themes: ["#AmorDeDios", "#Salvacion"] },
    { locale: "en", reference: "John 3:16-17", verses: ["3:16 For God so loved the world.", "3:17 That the world through him might be saved."], follow: "Follow us", themes: ["#GodsLove", "#Salvation"] },
    { locale: "pt", reference: "João 3:16-17", verses: ["3:16 Porque Deus amou o mundo.", "3:17 Para que o mundo fosse salvo por ele."], follow: "Siga-nos", themes: ["#AmorDeDeus", "#Salvacao"] }
  ] as const;
  for (const { locale, reference, verses, follow, themes } of cases) {
    const title = introTitle(locale, reference, "Test Bible");
    const files = publicationDescriptions(locale, title, [...verses]);
    assert.deepEqual(Object.keys(files).sort(), ["instagram.txt", "tiktok.txt", "x.txt", "youtube.txt"]);
    for (const text of Object.values(files)) {
      assert.ok(text.includes(title.title));
      assert.ok(text.includes(reference));
      assert.ok(text.includes("Test Bible"));
      assert.ok(text.includes("veobible.com"));
      for (const tag of themes) assert.ok(text.includes(tag), `${locale}: ${tag}`);
    }
    assert.ok(files["x.txt"].includes(verses.join("\n")));
    assert.ok(files["youtube.txt"].includes(follow));
    assert.match(files["youtube.txt"], /#Shorts/);
    assert.match(files["instagram.txt"], /#Reels/);
    assert.ok(!files["tiktok.txt"].includes(verses[0]));
  }
});

test("thumbnail uses the first frame strictly after the last intro entrance", () => {
  for (const length of [1.3, 3, 8.16]) {
    for (const rate of [12, 24, 30, 30000 / 1001]) {
      const time = introThumbnailTime(length, `${rate}/1`);
      const end = introAnimationEnd(length) + 1 / rate;
      assert.ok(time > end);
      assert.ok(time - end <= 1 / rate + 1e-9);
      assert.ok(Math.abs(time * rate - Math.round(time * rate)) < 1e-9);
      assert.ok(time < length - 0.5, "Thumbnail precedes the transition to reading");
    }
  }
});
