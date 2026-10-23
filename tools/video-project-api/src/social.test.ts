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

test("both video formats show only the explicitly configured domain", async () => {
  for (const outro of [shortOutro, longOutro]) {
    for (const locale of ["es", "en", "pt"] as const) {
      assert.equal((await outro(locale)).website, "");
      assert.equal(
        (await outro(locale, {}, "veobible.com")).website,
        "veobible.com",
      );
      assert.equal(
        (await outro(locale, {}, `${locale}.example.org`)).website,
        `${locale}.example.org`,
      );
      assert.equal((await outro(locale, {}, "  ")).website, "");
      await assert.rejects(() => outro(locale, {}, "https://example.org/path"));
    }
  }
});

test("configured language titles survive both request boundaries and replace branding in all formats", async () => {
  const { renderSchema: dashboardSchema } =
    await import("../../../apps/dashboard/src/lib/video-schema");
  const { renderSchema, previewSchema } = await import("./protocol");
  const settings = {
    es: { shortTitle: "VeoBiblia", title: "VeoBiblia en Español" },
    en: { shortTitle: "English name", title: "A custom English title" },
    pt: { shortTitle: "Bíblia", title: "Bíblia em Português" },
  };
  for (const kind of ["short", "long", "book"] as const) {
    for (const locale of ["es", "en", "pt"] as const) {
      const accounts = settings[locale];
      const transported = dashboardSchema.parse({
        id: "00000000-0000-4000-8000-000000000001",
        projectId: 1,
        kind,
        version: { id: "example", locale, label: "Example" },
        passage: {
          id: "john-1",
          book: "john",
          start: { chapter: 1, verse: 1 },
          end: { chapter: 1, verse: 2 },
        },
        settings: {},
        socialAccounts: {
          ...accounts,
          youtube: "",
          x: "",
          instagram: "",
          tiktok: "",
          facebook: "",
        },
      });
      for (const schema of [renderSchema, previewSchema]) {
        const received = schema.parse(transported).socialAccounts;
        const outro = await (kind === "short" ? shortOutro : longOutro)(
          locale,
          received,
        );
        assert.equal(outro.shortTitle, accounts.shortTitle.toUpperCase());
        assert.equal(outro.channel, accounts.title);
        assert.deepEqual(outro.social, []);
      }
    }
  }
});

test("missing or cleared language titles stay empty instead of using brand defaults", async () => {
  const { renderSchema } = await import("./protocol");
  for (const outro of [shortOutro, longOutro]) {
    for (const locale of ["es", "en", "pt"] as const) {
      for (const accounts of [
        undefined,
        renderSchema.shape.socialAccounts.parse(undefined),
        { shortTitle: "  ", title: "  " },
      ]) {
        const result = await outro(locale, accounts);
        assert.equal(result.shortTitle, "");
        assert.equal(result.channel, "");
      }
    }
  }
});
