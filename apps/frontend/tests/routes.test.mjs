import './loader.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readerSegment } from '../src/lib/reader/routes.ts'
import { parseReaderPath } from '../src/lib/reader/navigation.ts'
test('localized reader routes parse consistently', () => {
  for (const [lang, segment] of [['es','leer'],['en','read'],['pt','ler']]) {
    assert.equal(readerSegment(lang), segment)
    assert.equal(parseReaderPath(`/${lang}/${segment}/kjv/genesis/1`).chapter, '1')
  }
  assert.equal(parseReaderPath('/es/read/rv1909/genesis/1'), null)
  assert.equal(parseReaderPath('/en/read/kjv/genesis/1junk'), null)
})
