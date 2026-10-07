import { SignJWT, jwtVerify } from "jose";

export const tokenLifetimeSeconds = 60 * 60 * 24 * 30;
const issuer = "veobible-dashboard";
const audience = "veobible-dashboard";

function secretKey(secret: string) {
  const key = new TextEncoder().encode(secret);
  if (key.length < 32)
    throw new Error("JWT_SECRET must contain at least 32 bytes");
  return key;
}

export async function signToken(
  userId: string,
  authVersion: number,
  secret: string,
) {
  return new SignJWT({ authVersion })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey(secret));
}

export async function verifyToken(
  token: string,
  secret: string,
): Promise<{ userId: string; authVersion: number } | null> {
  const key = secretKey(secret);
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
      issuer,
      audience,
      requiredClaims: ["sub", "iat", "exp", "authVersion"],
    });
    if (
      typeof payload.sub !== "string" ||
      !payload.sub ||
      !Number.isSafeInteger(payload.authVersion) ||
      (payload.authVersion as number) < 0
    )
      return null;
    return { userId: payload.sub, authVersion: payload.authVersion as number };
  } catch {
    return null;
  }
}
