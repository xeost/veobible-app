import app from "vinext/server/fetch-handler";
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
    env: ReleaseEnvironment,
    ctx: ExecutionContext,
  ) {
    if (new URL(request.url).pathname === "/api/site-export")
      return exportRelease(request, env);
    return app.fetch(request, env, ctx);
  },
  async scheduled(_event: ScheduledEvent, env: ReleaseEnvironment) {
    await reconcileReleases(env);
  },
};
