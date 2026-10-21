import { test } from "node:test";
import assert from "node:assert/strict";
import {
  browserLanguage,
  persistBrowserLanguage,
  resolveLanguagePreference,
} from "./language-preference";

test("saved server language wins over stale browser storage after a reload", () => {
  assert.equal(
    resolveLanguagePreference("session=abc; veo_language=es", "en"),
    "es",
  );
  assert.equal(
    resolveLanguagePreference("veo_language=pt; session=abc", "en"),
    "pt",
  );
  assert.equal(resolveLanguagePreference("veo_language=en", "es"), "en");
});

test("older preferences restore without a cookie and invalid values retain the initial language", () => {
  assert.equal(resolveLanguagePreference("", "es"), "es");
  assert.equal(resolveLanguagePreference("veo_language=invalid", "pt"), "pt");
  assert.equal(resolveLanguagePreference("", null, "es"), "es");
  assert.equal(resolveLanguagePreference("not_veo_language=pt", null), "en");
});

test("restoring or explicitly changing the language synchronizes preferences for subsequent reloads and requests", (context) => {
  const values = new Map([["veo-language", "en"]]);
  const document = {
    cookie: "veo_language=es",
    documentElement: { lang: "es" },
  };
  const originals = ["document", "localStorage"].map(
    (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
  );
  context.after(() => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: document,
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    },
  });
  const restored = browserLanguage();
  assert.equal(restored, "es");
  persistBrowserLanguage(restored);
  assert.equal(values.get("veo-language"), "es");
  assert.equal(browserLanguage(), "es");
  persistBrowserLanguage("pt");
  assert.equal(document.documentElement.lang, "pt");
  assert.equal(values.get("veo-language"), "pt");
  assert.equal(browserLanguage(), "pt");
});
