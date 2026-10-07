import { test } from "node:test";
import assert from "node:assert/strict";
import {
  passwordHash,
  verifyPassword,
  digest,
  sessionCookie,
} from "./security";
import { settingsSchema, renderSchema, updateSchema } from "./video-schema";
test("password hashing and session security", async () => {
  const password = "a secure test password";
  const hash = await passwordHash(password);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword("wrong", hash), false);
  assert.equal(await verifyPassword(password, "invalid"), false);
  assert.notEqual(hash, await passwordHash(password));
  assert.equal((await digest("token")).length, 64);
  assert.match(
    sessionCookie("token", true),
    /HttpOnly; SameSite=Lax; Max-Age=2592000; Secure/,
  );
});
test("render contract rejects invalid paths, versions and settings", () => {
  assert.throws(() => settingsSchema.parse({ volumeMultiplier: 5 }));
  assert.throws(() => settingsSchema.parse({ background: "../secret.mp4" }));
  assert.throws(() => renderSchema.parse({ id: "../file" }));
  assert.equal(settingsSchema.parse({}).volumeMultiplier, 1);
  assert.throws(() =>
    updateSchema.parse({ status: "done", stage: "Complete" }),
  );
});

test("project settings discard obsolete narration controls while preserving all editable rendering values", () => {
  const input = {
    volumeMultiplier: 1.5,
    overrideReadingVolume: false,
    passageOffsets: { startSeconds: -0.25, endSeconds: 0.5 },
    verseOffsets: [
      {
        reference: "John 3:16",
        startOffsetSeconds: 0.1,
        endOffsetSeconds: -0.2,
      },
    ],
    background: "bg-2.mp4",
  };
  assert.deepEqual(
    settingsSchema.parse({
      ...input,
      reuseVoices: false,
      clipAudioMode: "video",
    }),
    input,
  );
  assert.deepEqual(Object.keys(settingsSchema.parse({})).sort(), [
    "overrideReadingVolume",
    "passageOffsets",
    "verseOffsets",
    "volumeMultiplier",
  ]);
});
