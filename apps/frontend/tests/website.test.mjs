import test from 'node:test'
import assert from 'node:assert/strict'
import { validateContent, youtubeId } from '../../../packages/website/content.ts'
const content = {
  schema: 1,
  publications: [
    {
      projectId: 1,
      kind: 'short',
      locale: 'es',
      version: 'rv1909',
      slug: 'genesis-1',
      title: 'Génesis',
      description: '',
      youtubeId: 'abcdefghijk',
      passage: {
        book: 'genesis',
        start: { chapter: 1, verse: 1 },
        end: { chapter: 1, verse: 3 }
      }
    }
  ],
  bookVideos: []
}
test('publication validation rejects nonexistent passages, unsafe links and duplicate page addresses', () => {
  assert.equal(youtubeId('https://youtu.be/abcdefghijk'), 'abcdefghijk')
  assert.equal(
    youtubeId('https://www.youtube.com/shorts/abcdefghijk'),
    'abcdefghijk'
  )
  assert.equal(youtubeId('https://evil.test/watch?v=abcdefghijk'), null)
  const invalid = structuredClone(content)
  invalid.publications[0].passage.end.verse = 999
  assert.throws(() => validateContent(invalid))
  const backwards = structuredClone(content)
  backwards.publications[0].passage.end.chapter = 1
  backwards.publications[0].passage.start.chapter = 2
  assert.throws(() => validateContent(backwards))
  assert.throws(() =>
    validateContent({
      ...content,
      publications: [
        content.publications[0],
        { ...content.publications[0], projectId: 2 }
      ]
    })
  )
})
