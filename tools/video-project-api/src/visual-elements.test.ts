import assert from "node:assert/strict";
import test from "node:test";
import { settingsSchema } from "./protocol";
import { settingsSchema as dashboardSettingsSchema } from "../../../apps/dashboard/src/lib/video-schema";
import { visualElementRanges, subscribeElementSchema } from "./visual-elements";

const element = subscribeElementSchema.parse({
  template: "youtube-subscribe",
  label: "Subscribe",
  subscribedLabel: "Subscribed",
});
const timeline = {
  introLength: 10,
  readingLength: 40,
  outroLength: 8,
  transitionDuration: 1,
  readingSilence: 2,
  verseCues: [
    { reference: "John 1:1", start: 6, end: 12 },
    { reference: "John 1:2", start: 14, end: 18 },
  ],
  chapterIntroductions: [{ part: "chapter-1", start: 0, duration: 5 }],
};

test("visual elements survive settings validation and older projects need no elements", () => {
  assert.equal(settingsSchema.parse({}).visualElements, undefined);
  const saved = settingsSchema.parse({ visualElements: { intro: element } });
  assert.deepEqual(saved.visualElements?.intro, [
    { ...element, id: "legacy-0" },
  ]);
  assert.deepEqual(
    dashboardSettingsSchema.parse(saved).visualElements,
    saved.visualElements,
  );
  assert.equal(
    subscribeElementSchema.safeParse({ ...element, durationSeconds: -1 })
      .success,
    false,
  );
  assert.equal(
    subscribeElementSchema.safeParse({ ...element, startSeconds: Infinity })
      .success,
    false,
  );
  assert.equal(
    settingsSchema.safeParse({ visualElements: { unknown: element } }).success,
    false,
  );
});

test("place intro, chapter, reading and outro relative to their own timelines", () => {
  const ranges = visualElementRanges(timeline, {
    intro: element,
    "chapter-1": element,
    "reading-0": {
      ...element,
      startSeconds: 1,
      references: ["John 1:1", "John 1:2"],
    },
    outro: element,
  });
  assert.deepEqual(
    ranges.map(({ id, start, duration }) => ({ id, start, duration })),
    [
      { id: "intro", start: 0, duration: 5 },
      { id: "chapter-1", start: 11, duration: 5 },
      { id: "reading-0", start: 18, duration: 5 },
      { id: "outro", start: 48, duration: 5 },
    ],
  );
});

test("clip elements at section end and omit hidden, unavailable or out-of-range elements", () => {
  assert.deepEqual(
    visualElementRanges(timeline, {
      intro: { ...element, startSeconds: 8 },
    }).map((item) => item.duration),
    [2],
  );
  assert.deepEqual(
    visualElementRanges(timeline, {
      intro: { ...element, startSeconds: 10 },
      outro: { ...element, hidden: true },
      "chapter-9": element,
      "reading-0": { ...element, references: ["missing"] },
    }),
    [],
  );
});

test("social buttons default to lower intermediate and early third, retain only their two controls and translate from video language", async () => {
  const {
    socialButtonElementSchema,
    socialButtonText,
    verticalPositions,
    elementMoments,
  } = await import("./visual-elements");
  const social = socialButtonElementSchema.parse({
    template: "social-button",
    label: "wrong",
    durationSeconds: 99,
  });
  assert.deepEqual(social, {
    template: "social-button",
    verticalPosition: "lower-intermediate",
    moment: "early",
    hidden: false,
  });
  for (const verticalPosition of verticalPositions)
    for (const moment of elementMoments) {
      const settings = settingsSchema.parse({
        visualElements: { intro: { ...social, verticalPosition, moment } },
      });
      assert.deepEqual(
        dashboardSettingsSchema.parse(settings).visualElements,
        settings.visualElements,
      );
    }
  assert.deepEqual(socialButtonText("es", "subscribe"), {
    label: "Suscribirse",
    subscribedLabel: "Suscrito",
  });
  assert.deepEqual(socialButtonText("pt", "follow"), {
    label: "Seguir",
    subscribedLabel: "Seguindo",
  });
  assert.deepEqual(socialButtonText("en", "follow"), {
    label: "Follow",
    subscribedLabel: "Following",
  });
  assert.equal(
    socialButtonElementSchema.safeParse({ ...social, moment: "tomorrow" })
      .success,
    false,
  );
});

test("social button moments distribute five seconds within each section and fit very short sections", async () => {
  const { socialButtonElementSchema, elementTiming, elementMoments } =
    await import("./visual-elements");
  const social = socialButtonElementSchema.parse({ template: "social-button" });
  assert.deepEqual(
    elementMoments.map(
      (moment) => elementTiming({ ...social, moment }, 17).start,
    ),
    [0, 4, 6, 8, 12],
  );
  for (const moment of elementMoments) {
    assert.deepEqual(elementTiming({ ...social, moment }, 2), {
      start: 0,
      duration: 2,
    });
    assert.deepEqual(elementTiming({ ...social, moment }, 0), {
      start: 0,
      duration: 0,
    });
  }
  assert.deepEqual(
    visualElementRanges(timeline, {
      intro: social,
      "chapter-1": social,
      "reading-0": { ...social, references: ["John 1:1", "John 1:2"] },
      outro: { ...social, moment: "end" },
    }).map(({ id, start, duration }) => ({
      id,
      start: Number(start.toFixed(6)),
      duration,
    })),
    [
      { id: "intro", start: 1.666667, duration: 5 },
      { id: "chapter-1", start: 11, duration: 5 },
      { id: "reading-0", start: 19.333333, duration: 5 },
      { id: "outro", start: 51, duration: 5 },
    ],
  );
});

test("old section elements migrate to a list and multiple saved elements retain identity, settings and order", async () => {
  const { socialButtonElementSchema } = await import("./visual-elements");
  const social = socialButtonElementSchema.parse({
    template: "social-button",
    id: "second",
    moment: "end",
    verticalPosition: "top",
  });
  const migrated = settingsSchema.parse({ visualElements: { intro: element } });
  const saved = settingsSchema.parse({
    visualElements: { intro: [...migrated.visualElements!.intro, social] },
  });
  const restored = dashboardSettingsSchema.parse(
    JSON.parse(JSON.stringify(saved)),
  );
  assert.deepEqual(restored.visualElements?.intro, [
    { ...element, id: "legacy-0" },
    social,
  ]);
  const remaining = settingsSchema.parse({
    ...restored,
    visualElements: {
      intro: restored.visualElements!.intro.filter(
        (item) => item.id !== "legacy-0",
      ),
    },
  });
  assert.deepEqual(remaining.visualElements?.intro, [social]);
  assert.deepEqual(
    settingsSchema.parse({ visualElements: { intro: [] } }).visualElements
      ?.intro,
    [],
  );
});

test("every element in a section has its own render timing and key, and hidden elements do not suppress siblings", async () => {
  const { socialButtonElementSchema } = await import("./visual-elements");
  const social = socialButtonElementSchema.parse({
    template: "social-button",
    id: "social",
    moment: "end",
  });
  const values = {
    intro: [
      { ...element, id: "first" },
      social,
      { ...element, id: "hidden", hidden: true },
    ],
    "reading-0": [
      {
        ...element,
        id: "reading-first",
        references: ["John 1:1"],
        startSeconds: 0,
      },
      {
        ...element,
        id: "reading-second",
        references: ["John 1:1"],
        startSeconds: 2,
      },
    ],
  };
  const ranges = visualElementRanges(timeline, values);
  assert.deepEqual(
    ranges.map(({ key, start, duration }) => ({ key, start, duration })),
    [
      { key: "intro:first", start: 0, duration: 5 },
      { key: "intro:social", start: 5, duration: 5 },
      { key: "reading-0:reading-first", start: 17, duration: 5 },
      { key: "reading-0:reading-second", start: 19, duration: 4 },
    ],
  );
  assert.equal(new Set(ranges.map((item) => item.key)).size, ranges.length);
});

test("custom vertical positions preserve percentages through saving and use the same coordinates as named positions", async () => {
  const {
    socialButtonElementSchema,
    socialVerticalPosition,
    verticalPositionFraction,
  } = await import("./visual-elements");
  for (const height of [0, 22.5, 50, 77.33, 100]) {
    const element = socialButtonElementSchema.parse({
      template: "social-button",
      verticalPosition: "custom",
      customVerticalPosition: height,
    });
    const saved = settingsSchema.parse({
      visualElements: { intro: [element] },
    });
    const restored = dashboardSettingsSchema.parse(
      JSON.parse(JSON.stringify(saved)),
    );
    const actual = restored.visualElements!.intro[0];
    assert.equal(actual.template, "social-button");
    if (actual.template !== "social-button")
      throw new Error("Unexpected template");
    assert.equal(actual.customVerticalPosition, height);
    assert.equal(socialVerticalPosition(actual), height / 100);
  }
  assert.equal(socialVerticalPosition({ verticalPosition: "custom" }), 0.5);
  assert.equal(
    socialVerticalPosition({
      verticalPosition: "upper-intermediate",
      customVerticalPosition: 90,
    }),
    verticalPositionFraction["upper-intermediate"],
  );
  for (const invalid of [-0.01, 100.01, NaN, Infinity]) {
    assert.equal(
      socialButtonElementSchema.safeParse({
        template: "social-button",
        verticalPosition: "custom",
        customVerticalPosition: invalid,
      }).success,
      false,
    );
  }
});

test("custom horizontal positions persist independently of height, default to center and apply only in custom mode", async () => {
  const {
    socialButtonElementSchema,
    socialHorizontalPosition,
    socialVerticalPosition,
  } = await import("./visual-elements");
  for (const horizontal of [0, 25.5, 50, 83.75, 100]) {
    const element = socialButtonElementSchema.parse({
      template: "social-button",
      verticalPosition: "custom",
      customVerticalPosition: 30,
      customHorizontalPosition: horizontal,
    });
    const saved = settingsSchema.parse({
      visualElements: { intro: [element] },
    });
    const actual = dashboardSettingsSchema.parse(
      JSON.parse(JSON.stringify(saved)),
    ).visualElements!.intro[0];
    if (actual.template !== "social-button")
      throw new Error("Unexpected template");
    assert.equal(actual.customHorizontalPosition, horizontal);
    assert.equal(socialHorizontalPosition(actual), horizontal / 100);
    assert.equal(socialVerticalPosition(actual), 0.3);
  }
  assert.equal(socialHorizontalPosition({ verticalPosition: "custom" }), 0.5);
  assert.equal(
    socialHorizontalPosition({
      verticalPosition: "top",
      customHorizontalPosition: 90,
    }),
    0.5,
  );
  for (const invalid of [-1, 101, NaN, Infinity]) {
    assert.equal(
      socialButtonElementSchema.safeParse({
        template: "social-button",
        customHorizontalPosition: invalid,
      }).success,
      false,
    );
  }
});
