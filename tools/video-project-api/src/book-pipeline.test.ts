import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

test("book analysis includes every verse and chapter announcement and uses its own backgrounds and outputs", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "book-pipeline-"));
  try {
    const videos = path.join(root, "books", "material", "videos");
    await fs.mkdir(videos, { recursive: true });
    await fs.writeFile(
      path.join(videos, "bg-1.mp4"),
      "background selection fixture",
    );
    const { stdout } = await promisify(execFile)(
      process.execPath,
      [
        "--import",
        "tsx",
        "--input-type=module",
        "-e",
        `
      import assert from 'node:assert/strict';
      import path from 'node:path';
      import { analyze, projectDir } from './src/pipeline.ts';
      import { settingsSchema } from './src/protocol.ts';
      import { introTitle } from './src/engines/long/episodes.ts';
      import { loadProjectProposals } from './src/project-proposals.ts';
      const proposals = await loadProjectProposals('book', { locale: 'es', code: 'rv1909' });
      const proposal = proposals.find(book => book.slug === 'jude');
      assert.ok(proposal);
      const result = await analyze({ kind: 'book',
        version: { id: 'rv1909', locale: 'es', label: 'Reina Valera 1909' },
        passage: { id: proposal.slug, book: proposal.start.book, start: proposal.start, end: proposal.end },
        settings: settingsSchema.parse({}), voiceTemplates: { intro: '', outro: '' },
      }, { originalOnly: true });
      assert.equal(result.cues.length, 25);
      assert.equal(result.chapterIntroductions.length, 1);
      assert.equal(result.chapterIntroductions[0].complete, true);
      assert.equal(result.m.config.videosDir, path.join(process.env.WORKING_DIR, 'books/material/videos'));
      assert.deepEqual(await result.m.video.backgroundVideos(result.m.config.videosDir), [path.join(result.m.config.videosDir, 'bg-1.mp4')]);
      assert.equal(projectDir('book', 'rv1909', 'jude'), path.join(process.env.WORKING_DIR, 'books/outputs/rv1909/jude'));
      assert.equal(projectDir('book', 'rv1909', 'jude', 'development'), path.join(process.env.WORKING_DIR, 'books/outputs-dev/rv1909/jude'));
      assert.equal(introTitle('es', result.episodeContent.display, 'Reina Valera 1909', undefined, true).title, 'Libros de la Biblia');
      console.log('book analysis passed');
    `,
      ],
      {
        cwd: fileURLToPath(new URL("..", import.meta.url)),
        env: { ...process.env, WORKING_DIR: root, BOOKS_DIR_NAME: "books" },
      },
    );
    assert.match(stdout, /book analysis passed/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
