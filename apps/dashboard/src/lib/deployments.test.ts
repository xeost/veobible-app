import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { deploymentStatus, isDeployHookUrl } from "./deployments";

test("only secure Cloudflare build hooks can be saved or invoked", () => {
  assert.equal(
    isDeployHookUrl(
      "https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/example",
    ),
    true,
  );
  for (const value of [
    "",
    "http://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/example",
    "https://example.com/hook",
    "https://api.cloudflare.com/other",
    "https://user:pass@api.cloudflare.com/client/v4/workers/builds/deploy_hooks/example",
    "https://api.cloudflare.com.evil.test/client/v4/workers/builds/deploy_hooks/example",
  ]) {
    assert.equal(isDeployHookUrl(value), false, value);
  }
});
test("build outcomes take priority and ambiguous completion stays unconfirmed", () => {
  assert.equal(
    deploymentStatus({ status: "stopped", build_outcome: "success" }),
    "success",
  );
  assert.equal(
    deploymentStatus({ status: "stopped", build_outcome: "failure" }),
    "failed",
  );
  assert.equal(
    deploymentStatus({ status: "stopped", build_outcome: "cancelled" }),
    "cancelled",
  );
  assert.equal(deploymentStatus({ status: "initializing" }), "building");
  assert.equal(deploymentStatus({ status: "queued" }), "queued");
  assert.equal(deploymentStatus({ status: "uploading" }), "deploying");
  assert.equal(deploymentStatus({ status: "stopped" }), "unknown");
});

test("site configuration persists updates and keeps legacy dashboard history separate", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(
      readFileSync(
        new URL("../../migrations/0001_dashboard.sql", import.meta.url),
        "utf8",
      ),
    );
    db.exec(
      "INSERT INTO deployments(status,target) VALUES ('requested','dashboard')",
    );
    const save = db.prepare(
      "INSERT INTO site_settings(key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
    );
    save.run("deploy_hook:veobible:site", "first", "2026-10-06T10:00:00Z");
    save.run("deploy_hook:veobible:site", "second", "2026-10-06T11:00:00Z");
    const row = db
      .prepare("SELECT value,updated_at FROM site_settings WHERE key=?")
      .get("deploy_hook:veobible:site");
    assert.equal(row?.value, "second");
    assert.equal(row?.updated_at, "2026-10-06T11:00:00Z");
    save.run("deploy_hook:veobible:site", "", "2026-10-06T12:00:00Z");
    assert.equal(
      db.prepare("SELECT value FROM site_settings").get()?.value,
      "",
    );
    db.exec(
      "INSERT INTO deployments(status,target,message) VALUES ('requested','site','Site update')",
    );
    const history = db
      .prepare("SELECT id FROM deployments WHERE target='site'")
      .all();
    assert.deepEqual(
      history.map((row) => row.id),
      [2],
    );
    assert.equal(
      db.prepare("SELECT target FROM deployments WHERE id=1").get()?.target,
      "dashboard",
    );
  } finally {
    db.close();
  }
});
