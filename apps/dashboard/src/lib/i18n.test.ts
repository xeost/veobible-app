import { test } from "node:test";
import assert from "node:assert/strict";
import { spanish } from "../i18n/es";
import { portuguese } from "../i18n/pt";
import { requestLanguage, translateServer } from "./i18n-server";

test("i18n dictionaries have identical keys", () => {
  const esKeys = Object.keys(spanish).sort();
  const ptKeys = Object.keys(portuguese).sort();

  assert.equal(esKeys.length, ptKeys.length);
  assert.deepEqual(esKeys, ptKeys);
});

test("all dictionary values are non-empty strings", () => {
  for (const [key, value] of Object.entries(spanish)) {
    assert.ok(
      typeof value === "string" && value.length > 0,
      `Empty Spanish value for "${key}"`,
    );
  }
  for (const [key, value] of Object.entries(portuguese)) {
    assert.ok(
      typeof value === "string" && value.length > 0,
      `Empty Portuguese value for "${key}"`,
    );
  }
});

test("language selector labels translate correctly in Spanish and Brazilian Portuguese", () => {
  assert.equal(
    spanish["Spanish (Latin American)"],
    "Español (latinoamericano)",
  );
  assert.equal(spanish["English (American)"], "Inglés (americano)");
  assert.equal(spanish["Portuguese (Brazil)"], "Portugués (de Brasil)");

  assert.equal(
    portuguese["Spanish (Latin American)"],
    "Espanhol (latino-americano)",
  );
  assert.equal(portuguese["English (American)"], "Inglês (americano)");
  assert.equal(portuguese["Portuguese (Brazil)"], "Português (do Brasil)");
});

test("core UI sections translate to accurate Spanish and Portuguese", () => {
  assert.equal(spanish["My profile"], "Mi perfil");
  assert.equal(portuguese["My profile"], "Meu perfil");

  assert.equal(spanish["Bible versions"], "Versiones de la Biblia");
  assert.equal(portuguese["Bible versions"], "Versões da Bíblia");

  assert.equal(spanish["Short Videos"], "Short Videos");
  assert.equal(portuguese["Short Videos"], "Vídeos Curtos");

  assert.equal(spanish["Long Videos"], "Long Videos");
  assert.equal(portuguese["Long Videos"], "Vídeos Longos");

  assert.equal(spanish["Publications"], "Publicaciones");
  assert.equal(portuguese["Publications"], "Publicações");

  assert.equal(spanish["Save changes"], "Guardar cambios");
  assert.equal(portuguese["Save changes"], "Salvar alterações");

  assert.equal(spanish["Cancel"], "Cancelar");
  assert.equal(portuguese["Cancel"], "Cancelar");

  assert.equal(spanish["Video sections"], "Secciones del video");
  assert.equal(portuguese["Video sections"], "Seções do vídeo");
});

test("backend language detection identifies language from x-language, cookie, and accept-language headers", () => {
  assert.equal(
    requestLanguage(
      new Request("http://localhost/api/summary", {
        headers: { "x-language": "pt" },
      }),
    ),
    "pt",
  );
  assert.equal(
    requestLanguage(
      new Request("http://localhost/api/summary", {
        headers: { cookie: "veo_language=es; other=123" },
      }),
    ),
    "es",
  );
  assert.equal(
    requestLanguage(
      new Request("http://localhost/api/summary", {
        headers: { "accept-language": "pt-BR,pt;q=0.9" },
      }),
    ),
    "pt",
  );
  assert.equal(
    requestLanguage(new Request("http://localhost/api/summary")),
    "en",
  );
});

test("backend server translation localizes API errors in English, Spanish and Portuguese", () => {
  // English (default baseline returns as-is)
  assert.equal(
    translateServer("Incorrect username or password", "en"),
    "Incorrect username or password",
  );
  assert.equal(translateServer("Route not found", "en"), "Route not found");
  assert.equal(
    translateServer("Incorrect current password", "en"),
    "Incorrect current password",
  );

  // Spanish
  assert.equal(
    translateServer("Incorrect username or password", "es"),
    "Usuario o contraseña incorrectos",
  );
  assert.equal(translateServer("Route not found", "es"), "Ruta no encontrada");
  assert.equal(
    translateServer("Incorrect current password", "es"),
    "Contraseña actual incorrecta",
  );

  // Portuguese
  assert.equal(
    translateServer("Incorrect username or password", "pt"),
    "Usuário ou senha incorretos",
  );
  assert.equal(translateServer("Route not found", "pt"), "Rota não encontrada");
  assert.equal(
    translateServer("Incorrect current password", "pt"),
    "Senha atual incorreta",
  );
});
