import assert from "node:assert/strict";
import test from "node:test";
import { renderVideoVariants } from "./render-variants";
import {
  socialButtonElementSchema,
  subscribeElementSchema,
} from "./visual-elements";
import { resultSchema } from "./protocol";
import { resultSchema as dashboardResultSchema } from "../../../apps/dashboard/src/lib/video-schema";
const social = socialButtonElementSchema.parse({ template: "social-button" });

test("one generic button anywhere renders exactly two variants and reuses the first background", async () => {
  for (const id of ["intro", "reading-3", "chapter-2", "outro"]) {
    const calls: unknown[] = [];
    const outputs = await renderVideoVariants(
      { [id]: social },
      async (variant, index, count, background) => {
        calls.push({ variant, index, count, background });
        return { background: background ?? "chosen.mp4", duration: 10 };
      },
    );
    assert.deepEqual(calls, [
      { variant: "subscribe", index: 0, count: 2, background: undefined },
      { variant: "follow", index: 1, count: 2, background: "chosen.mp4" },
    ]);
    assert.deepEqual(
      outputs.map((output) => output.variant),
      ["subscribe", "follow"],
    );
  }
});

test("old projects and hidden generic elements render once; failure of either variant rejects completion", async () => {
  const legacy = subscribeElementSchema.parse({
    template: "youtube-subscribe",
    label: "Subscribe",
    subscribedLabel: "Subscribed",
  });
  for (const elements of [
    undefined,
    { intro: legacy },
    { intro: { ...social, hidden: true } },
  ]) {
    let calls = 0;
    await renderVideoVariants(elements, async () => {
      calls++;
      return { background: "a.mp4" };
    });
    assert.equal(calls, 1);
  }
  await assert.rejects(
    renderVideoVariants({ intro: social }, async (variant) => {
      if (variant === "follow") throw new Error("render failed");
      return { background: "a.mp4" };
    }),
    /render failed/,
  );
});

test("both final video paths survive worker and dashboard completion validation", () => {
  const result = {
    output: "/output",
    video: "/output/0-short-subscribe.mp4",
    videoVariants: {
      follow: "/output/0-short-follow.mp4",
      subscribe: "/output/0-short-subscribe.mp4",
    },
    thumbnail: "/output/thumbnail.jpg",
    background: "a.mp4",
    duration: 10,
    readingDuration: 4,
    thumbnailTime: 1,
    descriptions: {},
    voiceScripts: {},
    sources: [],
    verseCues: [],
  };
  assert.deepEqual(
    dashboardResultSchema.parse(resultSchema.parse(result)).videoVariants,
    result.videoVariants,
  );
});

test("multiple final files explicitly name both variants for short, long and book while single files stay compatible", async () => {
  const {
    videoVariantFilename,
    renderedVideoFilename,
    generatedVideoFilenames,
  } = await import("./output-files");
  for (const kind of ["short", "long", "book"]) {
    assert.equal(
      videoVariantFilename(kind, "subscribe"),
      `0-${kind}-subscribe.mp4`,
    );
    assert.equal(videoVariantFilename(kind, "follow"), `0-${kind}-follow.mp4`);
    assert.equal(
      renderedVideoFilename(kind, "subscribe", 2),
      `0-${kind}-subscribe.mp4`,
    );
    assert.equal(
      renderedVideoFilename(kind, "follow", 2),
      `0-${kind}-follow.mp4`,
    );
    assert.equal(
      renderedVideoFilename(kind, "subscribe", 1),
      kind === "short" ? "0-short.mp4" : "0-episode.mp4",
    );
    assert.ok(
      generatedVideoFilenames(kind).includes(
        kind === "short" ? "0-short-subscribe.mp4" : "0-episode-subscribe.mp4",
      ),
    );
  }
});

test("generic elements anywhere in a section list trigger one pair of variants, including alongside legacy elements", async () => {
  const legacy = subscribeElementSchema.parse({
    template: "youtube-subscribe",
    label: "Subscribe",
    subscribedLabel: "Subscribed",
  });
  const outputs = await renderVideoVariants(
    { intro: [legacy, { ...social, hidden: true }, social], outro: [social] },
    async (variant) => ({ background: "same.mp4", variant }),
  );
  assert.deepEqual(
    outputs.map((item) => item.variant),
    ["subscribe", "follow"],
  );
  const single = await renderVideoVariants(
    { intro: [legacy, { ...social, hidden: true }], outro: [] },
    async () => ({ background: "same.mp4" }),
  );
  assert.equal(single.length, 1);
});
