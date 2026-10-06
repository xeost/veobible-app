import http from "node:http";

export function routeFor(pathname) {
  if (/^\/v1\/(?:projects|jobs|analyze|queue)(?:\/|$)/.test(pathname))
    return "video";
  return null;
}

export function createProxy({
  videoPort,
  token,
  isRunning = () => true,
  log = console.log,
}) {
  const ports = { video: videoPort };
  const check = async (service) => {
    if (!isRunning(service)) return { ok: false };
    try {
      const response = await fetch(
        `http://127.0.0.1:${ports[service]}/health`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(1_000),
        },
      );
      if (service !== "video" || !response.ok) return { ok: response.ok };
      const details = await response.json();
      return {
        ok: response.ok,
        videoProjectProtocolVersion: details.videoProjectProtocolVersion,
      };
    } catch {
      return { ok: false };
    }
  };

  return http.createServer(async (req, res) => {
    if (!token || req.headers.authorization !== `Bearer ${token}`) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
    const pathname =
      new URL(req.url || "/", "http://localhost").pathname.replace(
        /\/+$/,
        "",
      ) || "/";
    if (pathname === "/health") {
      const video = await check("video");
      const ok = video.ok;
      res.writeHead(ok ? 200 : 503, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(
        JSON.stringify({
          ok,
          service: "local-api-proxy",
          services: { video: video.ok },
          videoProjectProtocolVersion: video.videoProjectProtocolVersion,
        }),
      );
      log(`[proxy] ${req.method} ${req.url} ${res.statusCode}`);
      return;
    }

    const service = routeFor(pathname);
    if (!service) {
      res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "Route not found" }));
      log(`[proxy] ${req.method} ${req.url} 404`);
      return;
    }
    if (!isRunning(service)) {
      res.writeHead(503, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: `${service} API is unavailable` }));
      log(`[${service}] ${req.method} ${req.url} 503`);
      return;
    }

    const started = performance.now();
    let logged = false;
    const finish = (status) => {
      if (logged) return;
      logged = true;
      log(
        `[${service}] ${req.method} ${req.url} ${status} ${Math.round(performance.now() - started)}ms`,
      );
    };
    res.once("finish", () => finish(res.statusCode));
    res.once("close", () => finish("ABORTED"));

    const headers = { ...req.headers, host: `127.0.0.1:${ports[service]}` };
    const upstream = http.request(
      {
        hostname: "127.0.0.1",
        port: ports[service],
        path: req.url,
        method: req.method,
        headers,
      },
      (upstreamRes) => {
        res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
        upstreamRes.pipe(res);
      },
    );
    upstream.on("error", (error) => {
      log(`[${service}] Upstream error: ${error.message}`);
      if (!res.headersSent) {
        res.writeHead(502, {
          "Content-Type": "application/json; charset=utf-8",
        });
        res.end(JSON.stringify({ error: `${service} API is unavailable` }));
      } else res.destroy(error);
    });
    req.on("aborted", () => upstream.destroy());
    res.on("close", () => {
      if (!res.writableFinished) upstream.destroy();
    });
    req.pipe(upstream);
  });
}
