import { test } from "node:test";
import assert from "node:assert/strict";
import { SignJWT } from "jose";
import { signToken, verifyToken, tokenLifetimeSeconds } from "./jwt";

const secret = "test-secret-for-jwt-signing-with-at-least-32-bytes";
test("JWTs authenticate only the signed user and version and expire after 30 days", async () => {
  const token = await signToken(1, 2, secret);
  assert.equal(token.split(".").length, 3);
  assert.deepEqual(await verifyToken(token, secret), {
    userId: 1,
    authVersion: 2,
  });
  const payload = JSON.parse(
    Buffer.from(token.split(".")[1], "base64url").toString(),
  );
  assert.equal(payload.exp - payload.iat, tokenLifetimeSeconds);
  assert.equal(await verifyToken(token, secret + "wrong"), null);
  const forged = { ...payload, sub: "administrator" };
  assert.equal(
    await verifyToken(
      `${token.split(".")[0]}.${Buffer.from(JSON.stringify(forged)).toString("base64url")}.${token.split(".")[2]}`,
      secret,
    ),
    null,
  );
  assert.equal(await verifyToken("old-opaque-session-token", secret), null);
  await assert.rejects(signToken(1, 0, ""), /JWT_SECRET/);
});

test("expired tokens, wrong algorithms and invalid claims are rejected", async () => {
  const key = new TextEncoder().encode(secret);
  for (const [algorithm, version, issuer, expiry] of [
    ["HS256", 0, "veobible-dashboard", "-1s"],
    ["HS384", 0, "veobible-dashboard", "30d"],
    ["HS256", -1, "veobible-dashboard", "30d"],
    ["HS256", 0, "other-dashboard", "30d"],
  ] as const) {
    const token = await new SignJWT({ authVersion: version })
      .setProtectedHeader({ alg: algorithm })
      .setSubject("1")
      .setIssuer(issuer)
      .setAudience("veobible-dashboard")
      .setIssuedAt()
      .setExpirationTime(expiry)
      .sign(key);
    assert.equal(await verifyToken(token, secret), null);
  }
});
