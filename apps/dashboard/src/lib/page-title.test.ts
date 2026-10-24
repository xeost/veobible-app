import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { dashboardPageTitle } from "./page-title";
import { translateServer } from "./i18n-server";

const english = (text: string) => text;

test("every dashboard page has a specific browser title, including project editors", () => {
  const app = new URL("../app/", import.meta.url);
  const titles = new Set<string>();
  for (const entry of readdirSync(app, { recursive: true })) {
    const file = String(entry);
    if (!file.endsWith("page.tsx")) continue;
    const path =
      "/" +
      file
        .split("/")
        .filter((part) => !part.startsWith("(") && part !== "page.tsx")
        .map((part) => (part.startsWith("[") ? "example" : part))
        .join("/");
    const title = dashboardPageTitle(path, english);
    assert.notEqual(title, "VeoBible Dashboard", path);
    assert.ok(title.endsWith(" | VeoBible"), path);
    assert.ok(!titles.has(title), `Duplicate title for ${path}`);
    titles.add(title);
  }
});

test("titles follow the page and selected interface language", () => {
  assert.equal(
    dashboardPageTitle("/settings", english),
    "System settings | VeoBible",
  );
  assert.equal(
    dashboardPageTitle("/settings", (text) => translateServer(text, "es")),
    "Ajustes del sistema | VeoBible",
  );
  assert.equal(
    dashboardPageTitle("/settings", (text) => translateServer(text, "pt")),
    "Configurações do sistema | VeoBible",
  );
  assert.equal(
    dashboardPageTitle("/audios/edition/genesis", (text) =>
      translateServer(text, "es"),
    ),
    "Proyecto de audio | VeoBible",
  );
  assert.equal(
    dashboardPageTitle("/short-videos/123", english),
    "Video project · Short Videos | VeoBible",
  );
});

test("trailing slashes are normalized and unknown routes use a fallback", () => {
  assert.equal(
    dashboardPageTitle("/settings/", english),
    dashboardPageTitle("/settings", english),
  );
  assert.equal(dashboardPageTitle(null, english), "Dashboard | VeoBible");
  assert.equal(dashboardPageTitle("/unknown", english), "VeoBible Dashboard");
  assert.equal(
    dashboardPageTitle("/short-videos-extra", english),
    "VeoBible Dashboard",
  );
});
