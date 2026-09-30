import assert from "node:assert/strict";
import test from "node:test";
import { numberToWords, renderVoiceScripts, spokenReference, voiceContext } from "./voice.js";
import { config } from "./config.js";
import type { Passage } from "./shorts.js";

const range: Passage = { id: "john-3-14-19", book: "john", start: { chapter: 3, verse: 14 }, end: { chapter: 3, verse: 19 } };

test("las referencias del rango se escriben con palabras en los tres idiomas", async () => {
  const examples = [
    { locale: "es", book: "Juan", reference: "Juan capítulo tres versículos catorce al diecinueve" },
    { locale: "en", book: "John", reference: "John chapter three verses fourteen to nineteen" },
    { locale: "pt", book: "João", reference: "João capítulo três versículos catorze a dezenove" }
  ] as const;
  for (const example of examples) {
    const version = config.versions.find(value => value.locale === example.locale)!;
    const context = voiceContext(version, range, example.book, "Versión de prueba");
    assert.equal(context.reference, example.reference);
    const scripts = await renderVoiceScripts(context);
    assert.ok(scripts.intro.includes(example.reference));
    assert.ok(scripts.outro.includes(example.reference));
    assert.doesNotMatch(scripts.intro + scripts.outro, /\d/);
  }
});

test("los números compuestos y las centenas se pronuncian correctamente", () => {
  assert.equal(numberToWords("es", 21), "veintiuno");
  assert.equal(numberToWords("es", 100), "cien");
  assert.equal(numberToWords("es", 119), "ciento diecinueve");
  assert.equal(numberToWords("en", 21), "twenty-one");
  assert.equal(numberToWords("en", 119), "one hundred and nineteen");
  assert.equal(numberToWords("pt", 21), "vinte e um");
  assert.equal(numberToWords("pt", 100), "cem");
  assert.equal(numberToWords("pt", 119), "cento e dezenove");
});

test("los libros numerados, versículos únicos y rangos entre capítulos no conservan cifras", () => {
  const single: Passage = { ...range, start: { chapter: 1, verse: 21 }, end: { chapter: 1, verse: 21 } };
  const cross: Passage = { ...range, start: { chapter: 3, verse: 36 }, end: { chapter: 4, verse: 2 } };
  assert.equal(spokenReference("es", "1 Juan", single), "Primera de Juan capítulo uno versículo veintiuno");
  assert.equal(spokenReference("en", "2 John", single), "Second John chapter one verse twenty-one");
  assert.equal(spokenReference("pt", "3 João", single), "Terceira de João capítulo um versículo vinte e um");
  assert.equal(spokenReference("es", "Juan", cross), "Juan, desde el capítulo tres versículo treinta y seis hasta el capítulo cuatro versículo dos");
  assert.doesNotMatch(spokenReference("en", "John", cross), /\d/);
  assert.doesNotMatch(spokenReference("pt", "João", cross), /\d/);
});
