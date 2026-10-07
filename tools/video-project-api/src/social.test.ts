import { test } from "node:test";
import assert from "node:assert/strict";
import { outroTitle as shortOutro } from "./engines/short/social";
import { outroTitle as longOutro } from "./engines/long/social";
import { config as shortConfig } from "./engines/short/config";
import { config as longConfig } from "./engines/long/config";
test("both formats use request accounts in every language and do not require social configuration files", async () => {
  for (const outro of [shortOutro, longOutro]) {
    for (const locale of ["es", "en", "pt"] as const) {
      assert.deepEqual((await outro(locale)).social, []);
      const result = await outro(locale, {
        youtube: " canal_manual ",
        x: "@manual",
        instagram: "",
        tiktok: "",
        facebook: "pagina.manual",
      });
      assert.deepEqual(result.social, [
        { platform: "YouTube", handle: "@canal_manual" },
        { platform: "X", handle: "@manual" },
        { platform: "Facebook", handle: "@pagina.manual" },
      ]);
    }
  }
  assert.equal("socialAccounts" in shortConfig, false);
  assert.equal("socialAccounts" in longConfig, false);
});
