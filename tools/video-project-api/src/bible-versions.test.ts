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
