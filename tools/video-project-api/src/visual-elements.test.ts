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
  assert.deepEqual(saved.visualElements?.intro, element);
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
