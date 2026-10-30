import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { createProxy, routeFor } from "./proxy.mjs";
test("routes only registered video namespaces", () => {
  for (const p of [
    "/v1/projects/x",
    "/v1/projects/existing",
    "/v1/audio-projects",
    "/v1/audio-projects/options",
    "/v1/audio-projects/rv1909-v2/jude",
    "/v1/audio-projects/rv1909-v2/jude/generate",
    "/v1/audio-projects/rv1909-v2/jude/media",
    "/v1/jobs",
    "/v1/base-voices",
    "/v1/base-voices/es-2/sample",
    "/v1/analyze",
    "/v1/preview",
    "/v1/queue",
    "/v1/bible-versions",
    "/v1/video-project-proposals",
    "/v1/local-models",
    "/v1/local-models/local-model-1/updates",
  ])
    assert.equal(routeFor(p), "video");
  for (const p of [
    "/",
    "/v1/batches",
    "/v1/jobs-extra",
    "/v1/audio-projects-extra",
    "/v1/preview-extra",
    "/v1/bible-versions-extra",
    "/v1/local-models-extra",
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
    assert.equal((await fetch(`${base}/v1/local-models`)).status, 401);
    assert.equal(
      (await fetch(`${base}/v1/local-models/local-model-1/updates`)).status,
      401,
    );
    const updateCheck = await fetch(
      `${base}/v1/local-models/local-model-1/updates`,
      options,
    );
    assert.equal(
      (await updateCheck.json()).path,
      "/v1/local-models/local-model-1/updates",
    );
    const models = await fetch(`${base}/v1/local-models`, options);
    assert.equal(models.status, 202);
    assert.equal((await models.json()).path, "/v1/local-models");
    const refreshedModels = await fetch(
      `${base}/v1/local-models?refresh=1`,
      options,
    );
    assert.equal(
      (await refreshedModels.json()).path,
      "/v1/local-models?refresh=1",
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

for (const environment of ["production", "development"]) test(`audio requests retain ${environment}, authentication, body and media ranges through the proxy`, async () => {
  const token = "audio-proxy-test-token";
  const upstream = http.createServer(async (req, res) => {
    const chunks=[]; for await (const chunk of req) chunks.push(chunk);
    const body=JSON.parse(Buffer.concat(chunks).toString());
    if(req.url.includes('/media')) {
      assert.equal(req.headers.range,'bytes=0-3');
      assert.equal(body.outputEnvironment,environment);
      res.writeHead(206,{'Content-Type':'audio/wav','Content-Length':'4','Content-Range':'bytes 0-3/100','Accept-Ranges':'bytes'}); res.end('RIFF');
    } else {
      res.writeHead(200,{'Content-Type':'application/json'});
      res.end(JSON.stringify({path:req.url,auth:req.headers.authorization,body}));
    }
  });
  upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
  const proxy=createProxy({videoPort:upstream.address().port,token,log:()=>{}});
  proxy.listen(0,'127.0.0.1');await once(proxy,'listening');
  const base=`http://127.0.0.1:${proxy.address().port}`;
  try {
    const body={outputEnvironment:environment,versions:[{id:1,code:'rv1909',locale:'es',label:'Reina Valera 1909'}]};
    for(const path of ['/v1/audio-projects/options','/v1/audio-projects','/v1/audio-projects/rv1909-v2/jude','/v1/audio-projects/rv1909-v2/jude/generate']) {
      assert.equal((await fetch(base+path,{method:'POST',body:JSON.stringify(body)})).status,401);
      const response=await fetch(base+path,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
      assert.equal(response.status,200);
      assert.deepEqual(await response.json(),{path,auth:`Bearer ${token}`,body});
    }
    const media=await fetch(`${base}/v1/audio-projects/rv1909-v2/jude/media?chapter=1&verse=1`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',Range:'bytes=0-3'},body:JSON.stringify(body)});
    assert.equal(media.status,206);assert.equal(media.headers.get('content-range'),'bytes 0-3/100');assert.equal(await media.text(),'RIFF');
  } finally {proxy.closeAllConnections();proxy.close();upstream.closeAllConnections();upstream.close();}
});
