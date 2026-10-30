import app from "vinext/server/fetch-handler";
import { workerQueueRead } from "./lib/worker-queue-read";
import type { Bindings } from "./lib/env";
import {
  exportRelease,
  reconcileReleases,
  type ReleaseEnvironment,
} from "./lib/website-releases";
export * from "vinext/server/fetch-handler";
export default {
  ...app,
  async fetch(
    request: Request,
    env: ReleaseEnvironment & Bindings,
    ctx: ExecutionContext,
  ) {
    if (new URL(request.url).pathname === "/api/site-export")
      return exportRelease(request, env);
    const queue = await workerQueueRead(request, env);
    if (queue) return queue;
    return app.fetch(request, env, ctx);
  },
  async scheduled(_event: ScheduledEvent, env: ReleaseEnvironment) {
    await reconcileReleases(env);
  },
};
