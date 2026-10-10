import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { availableBibleVersions } from "./bible-versions.js";

test("version discovery reads each language directory and current index metadata", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bible-version-discovery-"));
  const index = async (locale: string, code: string, name: string) => {
    const directory = path.join(root, locale, code);
    await fs.mkdir(directory, {recursive:true});
    await fs.writeFile(path.join(directory,"index.json"),JSON.stringify({metadata:{name},books:[{id:"genesis"}]}));
  };
  try {
    await index("es","shared","Spanish name");
    await index("en","shared","English name");
    await index("es","another","Another name");
    await index("es","INVALID","Ignored");
    await fs.mkdir(path.join(root,"es","incomplete"));
    assert.deepEqual(await availableBibleVersions(root),[
      {locale:"en",code:"shared",label:"English name"},
      {locale:"es",code:"another",label:"Another name"},
      {locale:"es",code:"shared",label:"Spanish name"},
    ]);
    await index("es","shared","Updated name");
    assert.equal((await availableBibleVersions(root)).find(v=>v.locale === "es" && v.code === "shared")?.label,"Updated name");
    await fs.writeFile(path.join(root,"es","shared","index.json"),"malformed");
    await assert.rejects(availableBibleVersions(root));
  } finally {await fs.rm(root,{recursive:true,force:true});}
});

test("discovery merges overrides and originals while books use the effective index", async () => {
  const { availableBibleBooks } = await import("./bible-versions.js");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bible-version-overrides-"));
  const original = path.join(root, "original"), overrides = path.join(root, "overrides");
  const index = async (source: string, code: string, name: string, verses: number) => {
    const directory = path.join(source, "pt", code);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, "index.json"), JSON.stringify({
      metadata: { name }, books: [{ id: "genesis", name: "Gênesis", chapters: 1, versesPerChapter: [verses] }],
    }));
  };
  try {
    await index(original, "arc", "Original", 31);
    await index(overrides, "arc", "Replacement", 32);
    await index(overrides, "new", "New version", 20);
    await index(original, "partial", "Partial version", 30);
    await fs.mkdir(path.join(overrides, "pt", "partial"), { recursive: true });
    assert.deepEqual(await availableBibleVersions(original, overrides), [
      { locale: "pt", code: "arc", label: "Replacement" },
      { locale: "pt", code: "new", label: "New version" },
      { locale: "pt", code: "partial", label: "Partial version" },
    ]);
    assert.deepEqual((await availableBibleBooks("pt", "arc", original, overrides))[0].versesPerChapter, [32]);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
