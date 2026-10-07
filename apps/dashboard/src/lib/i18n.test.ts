import { test } from "node:test";
import assert from "node:assert/strict";
import { spanish } from "../i18n/es";
import { english } from "../i18n/en";
import { portuguese } from "../i18n/pt";

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
  for (const [key, value] of Object.entries(english)) {
    assert.ok(
      typeof value === "string" && value.length > 0,
      `Empty English value for "${key}"`,
    );
  }
});

test("language selector labels translate correctly in Spanish, English and Brazilian Portuguese", () => {
  // English keys
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

  // Legacy/backend keys
  assert.equal(
    english["Español (latinoamericano)"],
    "Spanish (Latin American)",
  );
  assert.equal(english["Inglés (americano)"], "English (American)");
  assert.equal(english["Portugués (de Brasil)"], "Portuguese (Brazil)");

  assert.equal(
    portuguese["Español (latinoamericano)"],
    "Espanhol (latino-americano)",
  );
  assert.equal(portuguese["Inglés (americano)"], "Inglês (americano)");
  assert.equal(portuguese["Portugués (de Brasil)"], "Português (do Brasil)");
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
