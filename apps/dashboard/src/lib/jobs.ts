import { db } from "./env";
import { updateSchema } from "./video-schema";
import { videoFetch } from "./video-client";
export async function applyUpdate(id: string, input: unknown) {
  const update = updateSchema.parse(input);
  const database = db();
  const job = await database
    .prepare("SELECT project_id,status FROM jobs WHERE id=?")
    .bind(id)
    .first<{ project_id: string; status: string }>();
  if (!job || ["done", "failed"].includes(job.status)) return;
  // The batch is atomic; terminal jobs cannot be overwritten by late progress callbacks.
  await database.batch([
    database
      .prepare(
        "UPDATE projects SET status=?,result=COALESCE(?,result),settings=CASE WHEN ? IS NOT NULL THEN json_set(settings,'$.background',?) ELSE settings END,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND EXISTS(SELECT 1 FROM jobs WHERE id=? AND status IN ('queued','running'))",
      )
      .bind(
        update.status === "done" ? "ready" : update.status,
        update.result ? JSON.stringify(update.result) : null,
        update.result?.background ?? null,
        update.result?.background ?? null,
        job.project_id,
        id,
      ),
    database
      .prepare(
        "UPDATE jobs SET status=?,stage=?,result=?,error=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status IN ('queued','running')",
      )
      .bind(
        update.status,
        update.stage,
        update.result ? JSON.stringify(update.result) : null,
        update.error ?? null,
        id,
      ),
  ]);
}
export async function syncJobs() {
  const jobs = await db()
    .prepare(
      "SELECT id,created_at FROM jobs WHERE status IN ('queued','running') LIMIT 20",
    )
    .all<{ id: string; created_at: string }>();
  await Promise.all(
    jobs.results.map(async (job) => {
      try {
        const response = await videoFetch(`/v1/jobs/${job.id}`);
        if (response.ok) {
          const state = (await response.json()) as { status: string };
          if (state.status !== "queued") await applyUpdate(job.id, state);
        } else if (
          response.status === 404 &&
          Date.now() - Date.parse(job.created_at) > 60000
        )
          await applyUpdate(job.id, {
            status: "failed",
            stage: "Interrumpido",
            error:
              "La API local perdió este trabajo o se reinició. Puedes regenerarlo con los ajustes guardados en D1.",
          });
      } catch {
        /* Disconnected laptop: retain durable job state until it can be reconciled. */
      }
    }),
  );
}
