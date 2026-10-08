import http from "node:http";
import {
  verifyMediaAccess,
  matchesMediaScope,
  mediaAsset,
} from "./media-access.mjs";

export function routeFor(pathname) {
  if (
    /^\/v1\/(?:projects|jobs|analyze|preview|queue|bible-versions|video-project-proposals)(?:\/|$)/.test(
      pathname,
    )
  )
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
    const url = new URL(req.url || "/", "http://localhost");
    const asset = mediaAsset(url.pathname);
    // Media uses scoped browser grants; control routes still require the private API token.
    if (asset && req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": req.headers.origin || "null",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "Range",
        "Access-Control-Max-Age": "600",
        Vary: "Origin",
      });
      res.end();
      return;
    }
    let scope = null;
    if (asset && ["GET", "HEAD"].includes(req.method)) {
      scope = await verifyMediaAccess(
        url.searchParams.get("mediaToken"),
        token,
      );
      if (
        scope &&
        (!matchesMediaScope(url, scope) ||
          (req.headers.origin && req.headers.origin !== scope.origin))
      )
        scope = null;
    }
    if (!token || (req.headers.authorization !== `Bearer ${token}` && !scope)) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
    const pathname = url.pathname.replace(/\/+$/, "") || "/";
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
      log(`[proxy] ${req.method} ${url.pathname} ${res.statusCode}`);
      return;
    }

    const service = routeFor(pathname);
    if (!service) {
      res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "Route not found" }));
      log(`[proxy] ${req.method} ${url.pathname} 404`);
      return;
    }
    if (!isRunning(service)) {
      res.writeHead(503, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: `${service} API is unavailable` }));
      log(`[${service}] ${req.method} ${url.pathname} 503`);
      return;
    }

    url.searchParams.delete("mediaToken");
    const forwardedPath = url.pathname + url.search;
    const started = performance.now();
    let logged = false;
    const finish = (status) => {
      if (logged) return;
      logged = true;
      log(
        `[${service}] ${req.method} ${forwardedPath} ${status} ${Math.round(performance.now() - started)}ms`,
      );
    };
    res.once("finish", () => finish(res.statusCode));
    res.once("close", () => finish("ABORTED"));

    const headers = {
      ...req.headers,
      host: `127.0.0.1:${ports[service]}`,
      authorization: `Bearer ${token}`,
    };
    const upstream = http.request(
      {
        hostname: "127.0.0.1",
        port: ports[service],
        path: forwardedPath,
        method: scope && req.method === "HEAD" ? "GET" : req.method,
        headers,
      },
      (upstreamRes) => {
        const responseHeaders = { ...upstreamRes.headers };
        if (scope) {
          responseHeaders["access-control-allow-origin"] = scope.origin;
          responseHeaders["access-control-expose-headers"] =
            "Content-Length, Content-Range, Accept-Ranges, Content-Disposition";
          responseHeaders["vary"] = "Origin";
          responseHeaders["cache-control"] = "private, no-store";
          responseHeaders["referrer-policy"] = "no-referrer";
          if (url.searchParams.has("download")) {
            const passage = url.searchParams.get("passage");
            const filename = /^[a-z0-9-]+$/i.test(passage || "")
              ? passage
              : "video";
            responseHeaders["content-disposition"] =
              `attachment; filename="${filename}.${asset === "thumbnail" ? "jpg" : asset === "intro" || asset === "outro" || asset.startsWith("chapter-") ? "wav" : "mp4"}"`;
          }
        }
        res.writeHead(upstreamRes.statusCode || 502, responseHeaders);
        if (scope && req.method === "HEAD") {
          res.end();
          upstreamRes.destroy();
        } else upstreamRes.pipe(res);
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
