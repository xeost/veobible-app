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
