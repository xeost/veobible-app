import { verifyToken } from "./jwt";
import { loadQueueView } from "./queue-projects";
import { outputEnvironment } from "./output-environment";
import { requestLanguage, translateServer } from "./i18n-server";

type QueueEnvironment = {
  DB: D1Database;
  JWT_SECRET: string;
  VIDEO_API_URL: string;
  DASHBOARD_API_PROXY_TOKEN: string;
};

export async function readGenerationQueue(
  database: D1Database,
  includeHistory: boolean,
  forward: (path: string) => Promise<Response>,
) {
  try {
    const environment = outputEnvironment();
    const response = await forward(
      `/v1/queue?outputEnvironment=${environment}&history=${includeHistory ? "1" : "0"}`,
    );
    if (!response.ok) throw new Error("Queue unavailable");
    const data = (await response.json()) as {
      items: {
        projectId: number | null;
        kind: string;
        status: string;
        type?: string;
        voice?: string;
        locale?: string;
        outputEnvironment?: string;
      }[];
      summary: { progress: number; completed: number; total: number };
    };
    return {
      connected: true,
      summary: data.summary,
      ...(await loadQueueView(
        database,
        data.items,
        includeHistory,
        environment,
      )),
    };
  } catch {
    return {
      connected: false,
      items: [],
      summary: { progress: 0, completed: 0, total: 0 },
    };
  }
}

/** Frequent sidebar polling must not enter the RSC/SSR request pipeline.
 * Verify both the signed session and its current database authorization on
 * every request; never cache user-specific responses or authorization. */
export async function workerQueueRead(
  req: Request,
  env: QueueEnvironment,
  fetcher: typeof fetch = fetch,
): Promise<Response | null> {
  const url = new URL(req.url);
  if (req.method !== "GET" || url.pathname !== "/api/generation-queue")
    return null;
  const json = (data: unknown, status = 200) =>
    Response.json(data, {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  const error = (message: string, status: number) =>
    json({ error: translateServer(message, requestLanguage(req)) }, status);
  try {
    const token = req.headers
      .get("cookie")
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("veo_session="))
      ?.slice(12);
    const session = token ? await verifyToken(token, env.JWT_SECRET) : null;
    if (!session) return error("Sign in", 401);
    const user = await env.DB.prepare(
      "SELECT id FROM dashboard_users WHERE id=? AND auth_version=? AND active=1",
    )
      .bind(session.userId, session.authVersion)
      .first();
    if (!user) return error("Sign in", 401);
    return json(
      await readGenerationQueue(
        env.DB,
        url.searchParams.get("history") === "1",
        (path) => {
          if (!env.DASHBOARD_API_PROXY_TOKEN)
            throw new Error("Queue credentials unavailable");
          return fetcher(`${env.VIDEO_API_URL.replace(/\/$/, "")}${path}`, {
            headers: {
              Authorization: `Bearer ${env.DASHBOARD_API_PROXY_TOKEN}`,
            },
            signal: AbortSignal.timeout(30000),
          });
        },
      ),
    );
  } catch (cause) {
    console.error("Queue read failed", cause);
    return error("Could not connect. Try again in a few moments.", 500);
  }
}
