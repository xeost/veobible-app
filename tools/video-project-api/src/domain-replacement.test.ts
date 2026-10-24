import test from "node:test";
import assert from "node:assert/strict";
import {
  domainReplacementOpacity,
  domainReplacementAnchor,
  type DomainReplacementRange,
} from "./domain-replacement";
import {
  socialButtonElementSchema,
  elementTiming,
  visualElementRanges,
} from "./visual-elements";
import { settingsSchema } from "./protocol";
import { settingsSchema as dashboardSettingsSchema } from "../../../apps/dashboard/src/lib/video-schema";
const element = socialButtonElementSchema.parse({
  template: "social-button",
  verticalPosition: "replace-domain",
});
const range: DomainReplacementRange = {
  id: "reading-0",
  element,
  start: 3.5,
  duration: 5,
};
const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test("domain fades out before the button and returns only after the complete presentation", () => {
  for (const [time, opacity] of [
    [3, 1],
    [3.2, 1],
    [3.35, 0.5],
    [3.5, 0],
    [6, 0],
    [8.5, 0],
    [8.65, 0.5],
    [8.8, 1],
    [10, 1],
  ])
    close(domainReplacementOpacity(time, [range], "reading"), opacity);
  assert.equal(domainReplacementOpacity(4, [range], "outro"), 1);
});

test("overlapping replacements keep the domain hidden; hidden and ordinary elements leave it visible", () => {
  const overlap = { ...range, start: 7, duration: 5 };
  assert.equal(domainReplacementOpacity(8.6, [range, overlap], "reading"), 0);
  assert.equal(domainReplacementOpacity(12.3, [range, overlap], "reading"), 1);
  assert.equal(
    domainReplacementOpacity(
      4,
      [{ ...range, element: { ...element, hidden: true } }],
      "reading",
    ),
    1,
  );
  assert.equal(
    domainReplacementOpacity(
      4,
      [{ ...range, element: { ...element, verticalPosition: "center" } }],
      "reading",
    ),
    1,
  );
  assert.equal(
    domainReplacementOpacity(4, [{ ...range, id: "outro" }], "outro"),
    0,
  );
  assert.equal(
    domainReplacementOpacity(4, [{ ...range, id: "chapter-1" }], "reading"),
    0,
  );
});

test("replacement timing reserves both fades at every chosen moment and still fits short sections", () => {
  for (const moment of ["start", "early", "middle", "late", "end"] as const) {
    const timing = elementTiming({ ...element, moment }, 12);
    close(timing.duration, 5);
    assert.ok(timing.start >= 0.3);
    assert.ok(timing.start + timing.duration <= 11.7 + 1e-8);
  }
  const timing = elementTiming({ ...element, moment: "middle" }, 12);
  close(timing.start, 3.5);
  const short = elementTiming(element, 0.4);
  close(short.start, 0.1);
  close(short.duration, 0.2);
  assert.deepEqual(elementTiming(element, 0), { start: 0, duration: 0 });
});

test("domain anchors match the actual reading and outro alignments in both formats", () => {
  assert.deepEqual(domainReplacementAnchor(1080, 1920, "reading"), {
    x: 116,
    y: 1385.36,
    align: "left",
  });
  assert.deepEqual(domainReplacementAnchor(1080, 1920, "outro"), {
    x: 112,
    y: 1312.56,
    align: "left",
  });
  assert.deepEqual(domainReplacementAnchor(1920, 1080, "reading"), {
    x: 1604,
    y: 853,
    align: "right",
  });
  assert.deepEqual(domainReplacementAnchor(1920, 1080, "outro"), {
    x: 160,
    y: 924.56,
    align: "left",
  });
});

test("the replacement setting survives both contracts and schedules independently in several sections", () => {
  const settings = settingsSchema.parse({
    visualElements: {
      intro: [element],
      "reading-0": [{ ...element, references: ["John 1:1"] }],
      outro: [element],
    },
  });
  assert.deepEqual(
    dashboardSettingsSchema.parse(JSON.parse(JSON.stringify(settings)))
      .visualElements,
    settings.visualElements,
  );
  const ranges = visualElementRanges(
    {
      introLength: 10,
      readingLength: 20,
      outroLength: 10,
      readingSilence: 1,
      transitionDuration: 1,
      verseCues: [{ reference: "John 1:1", start: 0, end: 12 }],
    },
    settings.visualElements,
  );
  assert.equal(ranges.length, 3);
  assert.ok(ranges.every((range) => range.duration === 5));
});

test("the explicit positioning mode controls replacement independently of vertical coordinates", () => {
  const replacement = socialButtonElementSchema.parse({
    template: "social-button",
    positionMode: "replace-domain",
    verticalPosition: "top",
  });
  assert.equal(
    domainReplacementOpacity(
      4,
      [{ ...range, element: replacement }],
      "reading",
    ),
    0,
  );
  assert.equal(elementTiming(replacement, 12).duration, 5);
  const coordinates = {
    ...replacement,
    positionMode: "coordinates" as const,
    verticalPosition: "replace-domain" as const,
  };
  assert.equal(
    domainReplacementOpacity(
      4,
      [{ ...range, element: coordinates }],
      "reading",
    ),
    1,
  );
});

test("both modes apply signed offsets and disabling offsets restores their exact base position", async () => {
  const { socialButtonPlacement } = await import("./domain-replacement");
  for (const [width, height] of [
    [1080, 1920],
    [1920, 1080],
  ]) {
    for (const scene of ["reading", "outro"] as const) {
      for (const positionMode of ["coordinates", "replace-domain"] as const) {
        const element = socialButtonElementSchema.parse({
          template: "social-button",
          positionMode,
          verticalPosition: "lower-third",
          horizontalPosition: "right-third",
          verticalOffset: -4.5,
          horizontalOffset: 3,
        });
        const base = socialButtonPlacement(element, width, height, scene);
        const moved = socialButtonPlacement(
          { ...element, offsetsEnabled: true },
          width,
          height,
          scene,
        );
        close(moved.x, base.x + width * 0.03);
        close(moved.y, base.y - height * 0.045);
        assert.equal(moved.align, base.align);
        assert.deepEqual(
          socialButtonPlacement(
            { ...element, offsetsEnabled: false },
            width,
            height,
            scene,
          ),
          base,
        );
      }
    }
  }
});

test("five coordinate presets and enabled offsets survive saving through both services", async () => {
  const { verticalPositions, horizontalPositions } =
    await import("./visual-elements");
  const { socialButtonPlacement } = await import("./domain-replacement");
  assert.deepEqual(verticalPositions, [
    "top",
    "upper-third",
    "center",
    "lower-third",
    "bottom",
  ]);
  assert.deepEqual(horizontalPositions, [
    "left",
    "left-third",
    "center",
    "right-third",
    "right",
  ]);
  for (const verticalPosition of verticalPositions)
    for (const horizontalPosition of horizontalPositions) {
      const element = socialButtonElementSchema.parse({
        template: "social-button",
        positionMode: "coordinates",
        verticalPosition,
        horizontalPosition,
        offsetsEnabled: true,
        verticalOffset: 2.5,
        horizontalOffset: -3,
      });
      const saved = settingsSchema.parse({
        visualElements: { "reading-0": [element] },
      });
      assert.deepEqual(
        dashboardSettingsSchema.parse(JSON.parse(JSON.stringify(saved)))
          .visualElements,
        saved.visualElements,
      );
      const placement = socialButtonPlacement(
        { ...element, offsetsEnabled: false },
        1080,
        1920,
      );
      const left =
        placement.align === "left"
          ? placement.x
          : placement.align === "right"
            ? placement.x - 600
            : placement.x - 300;
      assert.ok(
        left >= 0 && left + 600 <= 1080,
        `${horizontalPosition} must fit the frame`,
      );
    }
  for (const field of ["verticalOffset", "horizontalOffset"])
    for (const value of [-101, 101, Infinity, NaN])
      assert.equal(
        socialButtonElementSchema.safeParse({
          template: "social-button",
          [field]: value,
        }).success,
        false,
      );
});

test("horizontal presets move consistently from left to right without clipping the button", async () => {
  const { horizontalPositions } = await import("./visual-elements");
  const { socialButtonPlacement } = await import("./domain-replacement");
  for (const [width, height] of [
    [1080, 1920],
    [1920, 1080],
  ]) {
    const edges = horizontalPositions.map((horizontalPosition) => {
      const anchor = socialButtonPlacement(
        socialButtonElementSchema.parse({
          template: "social-button",
          horizontalPosition,
        }),
        width,
        height,
      );
      return anchor.align === "left"
        ? anchor.x
        : anchor.align === "right"
          ? anchor.x - 600
          : anchor.x - 300;
    });
    assert.equal(edges[0], 0);
    assert.equal(edges.at(-1), width - 600);
    for (let i = 1; i < edges.length; i++) assert.ok(edges[i] > edges[i - 1]);
  }
});
