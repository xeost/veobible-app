import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { config } from "./config.js";
import { isPassageUsed, markUsed, orderPassagesByUsage, passageUsageKey, readStatus, type Passage } from "./shorts.js";

test("usage is independent by locale and version, and legacy marks retain only their recorded scope", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "veobible-status-"));
  const originalOutput = config.outputDir;
  const es = config.versions.find(version => version.locale === "es")!;
  const alternate = config.versions.find(version => version.locale === "es" && version.id !== es.id)!;
  const en = config.versions.find(version => version.locale === "en")!;
  const passage: Passage = { id: "john-3-14-19", book: "john", start: { chapter: 3, verse: 14 }, end: { chapter: 3, verse: 19 } };
  const next = { ...passage, id: "john-1-1-2" };
  const file = path.join(root, "status.json");
  const old = { usedAt: "2026-01-01T00:00:00Z", locale: es.locale, version: es.id, output: "original-output" };
  try {
    Object.assign(config, { outputDir: root });
    assert.deepEqual(await readStatus(), {});
    const legacy = JSON.stringify({ [passage.id]: old });
    await fs.writeFile(file, legacy);
    let status = await readStatus();
    assert.equal(await fs.readFile(file, "utf8"), legacy, "Reading migrates in memory without modifying the file");
    assert.deepEqual(status[passageUsageKey(es, passage)], old);
    assert.equal(isPassageUsed(status, es, passage), true);
    assert.equal(isPassageUsed(status, alternate, passage), false);
    assert.equal(isPassageUsed(status, en, passage), false);
    assert.equal(isPassageUsed(status, { ...es, locale: "en" }, passage), false, "Locale is part of the identity even when the version ID matches");
    assert.deepEqual(orderPassagesByUsage([passage, next], status, es).map(item => item.id), [next.id, passage.id]);
    assert.deepEqual(orderPassagesByUsage([passage, next], status, en).map(item => item.id), [passage.id, next.id]);
    await assert.rejects(markUsed(passage, es, "duplicate"), /already marked/);
    await markUsed(passage, alternate, "alternate-output");
    await markUsed(passage, en, "english-output");
    status = await readStatus();
    for (const version of [es, alternate, en]) assert.equal(isPassageUsed(status, version, passage), true);
    assert.equal(Object.keys(status).length, 3);
    assert.deepEqual(status[passageUsageKey(es, passage)], old);
    const saved = JSON.parse(await fs.readFile(file, "utf8"));
    assert.equal(saved[passage.id], undefined);
    assert.equal(saved[passageUsageKey(en, passage)].output, "english-output");
    const newer = { ...old, usedAt: "2026-09-01T00:00:00Z" };
    for (const records of [
      { [passage.id]: old, [passageUsageKey(es, passage)]: newer },
      { [passageUsageKey(es, passage)]: newer, [passage.id]: old }
    ]) {
      await fs.writeFile(file, JSON.stringify(records));
      assert.deepEqual((await readStatus())[passageUsageKey(es, passage)], newer, "Explicit scoped marks take priority over legacy duplicates");
    }
    await fs.writeFile(file, JSON.stringify({ [passage.id]: { usedAt: old.usedAt } }));
    await assert.rejects(readStatus(), /Invalid status.json record/);
  } finally {
    Object.assign(config, { outputDir: originalOutput });
    await fs.rm(root, { recursive: true, force: true });
  }
});
