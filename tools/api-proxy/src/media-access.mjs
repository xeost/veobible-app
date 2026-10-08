const encode = (bytes) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
const decode = (value) =>
  Uint8Array.from(
    atob(value.replaceAll("-", "+").replaceAll("_", "/")),
    (char) => char.charCodeAt(0),
  );
const encoder = new TextEncoder();
const key = (secret, usage) =>
  crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );

export async function signMediaAccess(scope, secret) {
  const payload = encode(encoder.encode(JSON.stringify(scope)));
  const signature = await crypto.subtle.sign(
    "HMAC",
    await key(secret, "sign"),
    encoder.encode(`veobible-media-v1.${payload}`),
  );
  return `${payload}.${encode(new Uint8Array(signature))}`;
}

/** A media grant authorizes only GET/HEAD assets within one project and environment. */
export async function verifyMediaAccess(token, secret, now = Date.now()) {
  try {
    if (!secret || !token || token.length > 4096) return null;
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra !== undefined) return null;
    if (
      !(await crypto.subtle.verify(
        "HMAC",
        await key(secret, "verify"),
        decode(signature),
        encoder.encode(`veobible-media-v1.${payload}`),
      ))
    )
      return null;
    const scope = JSON.parse(new TextDecoder().decode(decode(payload)));
    if (
      !Number.isSafeInteger(scope.expiresAt) ||
      scope.expiresAt <= now ||
      scope.expiresAt > now + 3900000 ||
      !/^\/v1\/projects\/[1-9]\d*\/media\/$/.test(scope.path) ||
      typeof scope.query !== "string" ||
      typeof scope.origin !== "string" ||
      new URL(scope.origin).origin !== scope.origin
    )
      return null;
    return scope;
  } catch {
    return null;
  }
}

export function mediaAsset(pathname) {
  return (
    /^\/v1\/projects\/[1-9]\d*\/media\/(video|thumbnail|intro|outro|chapter-\d+|reading-\d+|preview-[0-9a-f-]{36}-\d+)$/.exec(
      pathname,
    )?.[1] ?? null
  );
}

export function matchesMediaScope(url, scope) {
  if (!mediaAsset(url.pathname) || !url.pathname.startsWith(scope.path))
    return false;
  const expected = new URLSearchParams(scope.query);
  for (const [key, value] of expected) {
    if (
      url.searchParams.getAll(key).length !== 1 ||
      url.searchParams.get(key) !== value
    )
      return false;
  }
  return [...url.searchParams.keys()].every(
    (key) =>
      expected.has(key) || ["mediaToken", "revision", "download"].includes(key),
  );
}
