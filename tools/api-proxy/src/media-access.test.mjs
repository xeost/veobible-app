import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { createProxy } from "./proxy.mjs";
import { signMediaAccess } from "./media-access.mjs";

test("browser media grants preserve streaming, ranges and downloads without granting control access", async () => {
  const secret = "private-proxy-secret-for-tests";
  const origin = "https://dash.veobible.com";
  const path = "/v1/projects/12/media/";
  const query =
    "kind=short&version=rv1909&passage=john-3-16&outputEnvironment=production";
  const forwarded = [];
  const logs = [];
  const upstream = http.createServer((req, res) => {
    forwarded.push({
      url: req.url,
      auth: req.headers.authorization,
      range: req.headers.range,
    });
    res.writeHead(req.headers.range ? 206 : 200, {
      "Content-Type": "video/mp4",
      "Content-Length": "4",
      "Accept-Ranges": "bytes",
      ...(req.headers.range ? { "Content-Range": "bytes 0-3/8" } : {}),
    });
    res.end("test");
  });
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");
  const proxy = createProxy({
    videoPort: upstream.address().port,
    token: secret,
    log: (line) => logs.push(line),
  });
  proxy.listen(0, "127.0.0.1");
  await once(proxy, "listening");
  const base = `http://127.0.0.1:${proxy.address().port}`;
  const scope = { path, query, origin, expiresAt: Date.now() + 3600000 };
  const grant = await signMediaAccess(scope, secret);
  const url = `${base}${path}video?${query}&mediaToken=${grant}`;
  try {
    const response = await fetch(url, {
      headers: { Origin: origin, Range: "bytes=0-3" },
    });
    assert.equal(response.status, 206);
    assert.equal(await response.text(), "test");
    assert.equal(response.headers.get("access-control-allow-origin"), origin);
    assert.equal(response.headers.get("content-range"), "bytes 0-3/8");
    assert.equal(forwarded[0].auth, `Bearer ${secret}`);
    assert.equal(forwarded[0].range, "bytes=0-3");
    assert.ok(!forwarded[0].url.includes("mediaToken"));
    assert.ok(logs.every((line) => !line.includes(grant)));
    for (const invalid of [
      url.replace("/12/", "/13/"),
      url.replace("version=rv1909", "version=kjv"),
      url.replace(
        "outputEnvironment=production",
        "outputEnvironment=development",
      ),
      `${url}&kind=long`,
      `${url}&file=private`,
      url.replace("/media/video", "/state"),
      `${base}/v1/queue?mediaToken=${grant}`,
      url.replace(
        grant,
        await signMediaAccess({ ...scope, expiresAt: Date.now() - 1 }, secret),
      ),
      url.replace(grant, await signMediaAccess(scope, "another-secret")),
    ])
      assert.equal((await fetch(invalid)).status, 401);
    assert.equal((await fetch(url, { method: "POST" })).status, 401);
    assert.equal(
      (await fetch(url, { headers: { Origin: "https://other.example" } }))
        .status,
      401,
    );
    const download = await fetch(`${url}&download=1`);
    assert.match(
      download.headers.get("content-disposition"),
      /attachment; filename="john-3-16.mp4"/,
    );
    await download.text();
    const head = await fetch(url, { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
    const preflight = await fetch(url, {
      method: "OPTIONS",
      headers: { Origin: origin, "Access-Control-Request-Headers": "Range" },
    });
    assert.equal(preflight.status, 204);
    assert.equal(
      preflight.headers.get("access-control-allow-headers"),
      "Range",
    );
  } finally {
    proxy.closeAllConnections();
    proxy.close();
    upstream.closeAllConnections();
    upstream.close();
  }
});
