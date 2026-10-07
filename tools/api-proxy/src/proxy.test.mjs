import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { createProxy, routeFor } from "./proxy.mjs";
test("routes only registered video namespaces", () => {
  for (const p of [
    "/v1/projects/x",
    "/v1/projects/existing",
    "/v1/jobs",
    "/v1/analyze",
    "/v1/preview",
    "/v1/queue",
    "/v1/bible-versions",
    "/v1/video-project-proposals",
  ])
    assert.equal(routeFor(p), "video");
  for (const p of [
    "/",
    "/v1/batches",
    "/v1/jobs-extra",
    "/v1/preview-extra",
    "/v1/bible-versions-extra",
    "/anything",
  ])
    assert.equal(routeFor(p), null);
});
test("auth, aggregate health, forwarding and unavailable upstream", async () => {
  const token = "test-token";
  const upstream = http.createServer((req, res) => {
    res.writeHead(req.url === "/health" ? 200 : 202, {
      "Content-Type": "application/json",
    });
    res.end(
      JSON.stringify(
        req.url === "/health"
          ? { videoProjectProtocolVersion: 1 }
          : { path: req.url, auth: req.headers.authorization },
      ),
    );
  });
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");
  const proxy = createProxy({
    videoPort: upstream.address().port,
    token,
    log: () => {},
  });
  proxy.listen(0, "127.0.0.1");
  await once(proxy, "listening");
  const base = `http://127.0.0.1:${proxy.address().port}`;
  try {
    assert.equal((await fetch(`${base}/health`)).status, 401);
    const options = { headers: { Authorization: `Bearer ${token}` } };
    const health = await fetch(`${base}/health`, options);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).services.video, true);
    const response = await fetch(`${base}/v1/jobs?x=1`, {
      ...options,
      method: "POST",
      body: "{}",
    });
    assert.equal(response.status, 202);
    assert.equal((await response.json()).path, "/v1/jobs?x=1");
    const versions = await fetch(`${base}/v1/bible-versions`, options);
    assert.equal(versions.status, 202);
    assert.deepEqual(await versions.json(), {
      path: "/v1/bible-versions",
      auth: `Bearer ${token}`,
    });
    const books = await fetch(
      `${base}/v1/bible-versions/books?locale=es&version=rv1909`,
      options,
    );
    assert.equal(books.status, 202);
    assert.equal(
      (await books.json()).path,
      "/v1/bible-versions/books?locale=es&version=rv1909",
    );
    const proposals = await fetch(
      `${base}/v1/video-project-proposals?kind=long&locale=es&version=rv1909`,
      options,
    );
    assert.equal(proposals.status, 202);
    assert.equal(
      (await proposals.json()).path,
      "/v1/video-project-proposals?kind=long&locale=es&version=rv1909",
    );
    assert.equal((await fetch(`${base}/v1/batches`, options)).status, 404);
    await new Promise((r) => upstream.close(r));
    assert.equal((await fetch(`${base}/health`, options)).status, 503);
  } finally {
    proxy.closeAllConnections();
    proxy.close();
    upstream.closeAllConnections();
    upstream.close();
  }
});
