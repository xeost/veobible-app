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
      etag: req.headers["if-none-match"],
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
    const generated = await fetch(
      url.replace("/media/video?", "/media/generated-reading-0?"),
      { headers: { Origin: origin, Range: "bytes=0-3" } },
    );
    assert.equal(generated.status, 206);
    assert.equal(await generated.text(), "test");
    const waveform = await fetch(
      url.replace("/media/video?", "/media/intro?") + "&waveform=1",
      {
        headers: { Origin: origin, "If-None-Match": '"recording-v1"' },
      },
    );
    assert.equal(waveform.status, 200);
    await waveform.text();
    assert.match(waveform.headers.get("access-control-expose-headers"), /ETag/);
    assert.equal(forwarded.at(-1).etag, '"recording-v1"');
    assert.ok(forwarded.at(-1).url.includes("waveform=1"));
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
      `${url}&waveform=2`,
      `${url}&waveform=1&waveform=1`,
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
    for (const variant of ["subscribe", "follow"]) {
      const variantUrl =
        url.replace("/media/video?", `/media/video-${variant}?`) +
        "&download=1";
      const response = await fetch(variantUrl, {
        headers: { Origin: origin, Range: "bytes=0-3" },
      });
      assert.equal(response.status, 206);
      assert.equal(
        response.headers.get("content-disposition"),
        `attachment; filename="john-3-16-${variant}.mp4"`,
      );
      assert.equal(await response.text(), "test");
    }
    const chapterDownload = await fetch(
      url.replace("/media/video?", "/media/chapter-0?") + "&download=1",
      { headers: { Origin: origin } },
    );
    assert.equal(chapterDownload.status, 200);
    assert.match(
      chapterDownload.headers.get("content-disposition"),
      /attachment; filename="john-3-16.wav"/,
    );
    assert.equal(await chapterDownload.text(), "test");
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
      "Range, If-None-Match",
    );
  } finally {
    proxy.closeAllConnections();
    proxy.close();
    upstream.closeAllConnections();
    upstream.close();
  }
});

test("audio grants stream verse, chapter and original media without authorizing other books or controls", async () => {
  const secret = "private-audio-proxy-secret-for-tests";
  const origin = "https://dash.veobible.com";
  const path = "/v1/audio-projects/rv1909-v2/genesis/";
  const query = "outputEnvironment=production&order=1&chapterCount=50";
  const forwarded = [];
  const logs = [];
  const upstream = http.createServer((req, res) => {
    forwarded.push({
      url: req.url,
      method: req.method,
      auth: req.headers.authorization,
      range: req.headers.range,
    });
    res.writeHead(req.headers.range ? 206 : 200, {
      "Content-Type": "audio/wav",
      "Content-Length": "4",
      "Accept-Ranges": "bytes",
      "Content-Disposition": 'attachment; filename="genesis-1-1.wav"',
      ...(req.headers.range ? { "Content-Range": "bytes 0-3/8" } : {}),
    });
    res.end("RIFF");
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
  const url = `${base}${path}media?${query}&chapter=1&verse=1&file=genesis%2Fverse.wav&revision=one&mediaToken=${grant}`;
  try {
    for (const target of [
      url,
      `${url}&download=1`,
      url.replace("/media?", "/original-media?"),
    ]) {
      const response = await fetch(target, {
        headers: { Origin: origin, Range: "bytes=0-3" },
      });
      assert.equal(response.status, 206);
      assert.equal(await response.text(), "RIFF");
      assert.equal(response.headers.get("access-control-allow-origin"), origin);
      assert.equal(response.headers.get("content-range"), "bytes 0-3/8");
      assert.equal(
        response.headers.get("content-disposition"),
        'attachment; filename="genesis-1-1.wav"',
      );
      assert.equal(forwarded.at(-1).auth, `Bearer ${secret}`);
      assert.equal(forwarded.at(-1).method, "GET");
      assert.ok(!forwarded.at(-1).url.includes("mediaToken"));
    }
    for (const target of [
      url.replace("/genesis/", "/exodus/"),
      url.replace("rv1909-v2", "rv1909-v3"),
      url.replace("production", "development"),
      `${url}&file=other`,
      `${url}&chapter=2`,
      `${url}&chapterCount=51`,
      url.replace("/media?", "/generate?"),
      `${url}&unknown=1`,
      url.replace(
        grant,
        await signMediaAccess({ ...scope, expiresAt: Date.now() - 1 }, secret),
      ),
    ])
      assert.equal((await fetch(target)).status, 401);
    assert.equal((await fetch(url, { method: "POST" })).status, 401);
    assert.equal(
      (await fetch(url, { headers: { Origin: "https://other.example" } }))
        .status,
      401,
    );
    const head = await fetch(url, { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
    const options = await fetch(url, {
      method: "OPTIONS",
      headers: { Origin: origin },
    });
    assert.equal(options.status, 204);
    assert.ok(logs.every((line) => !line.includes(grant)));
  } finally {
    proxy.closeAllConnections();
    proxy.close();
    upstream.closeAllConnections();
    upstream.close();
  }
});
