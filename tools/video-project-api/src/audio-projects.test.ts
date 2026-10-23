import { audioVerseApproval, isAudioVerseApproved } from "./audio-approvals.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  AudioProjects,
  assembleAudioChapter,
  type AudioGenerationDependencies,
} from "./audio-projects.js";
import { config } from "./engines/long/config.js";
import {
  type AudioProject,
  audioEditionSchema,
} from "./audio-project-schema.js";
const version = {
  id: 1,
  code: "rv1909",
  locale: "es",
  label: "Reina Valera 1909",
};
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "audio-projects-"));
  const projects = new AudioProjects(root);
  await fs.mkdir(path.join(root, "rv1909"));
  await fs.writeFile(
    path.join(root, "rv1909", "original.mp3"),
    "irreplaceable original",
  );
  return {
    root,
    projects,
    clean: () => fs.rm(root, { recursive: true, force: true }),
  };
}
function generation(failAt = Infinity) {
  let count = 0;
  const dependencies: AudioGenerationDependencies = {
    synthesize: async (directory, text) => {
      if (++count === failAt) throw new Error("test interruption");
      await fs.writeFile(path.join(directory, "intro.wav"), text);
    },
    duration: async () => 2,
    align: async () => ({ startSeconds: 0.17, endSeconds: 1.65 }),
    assemble: async (segments, output) => {
      await fs.writeFile(
        output,
        segments
          .map((s) => `${s.file}:${s.trim?.startSeconds ?? 0}:${s.pause}`)
          .join("\n"),
      );
    },
  };
  return { dependencies, count: () => count };
}
test("editions protect originals, reserve atomically and skip existing internal folders", async () => {
  const { root, projects, clean } = await fixture();
  try {
    assert.equal((await projects.nextEdition("rv1909")).edition, "rv1909-v2");
    const results = await Promise.allSettled([
      projects.create(version, "rv1909-v2"),
      projects.create(version, "rv1909-v2"),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal((await projects.list()).length, 66);
    assert.equal(
      await fs.stat(path.join(root, "rv1909-v2_internal", "jude.json")).then(
        () => true,
        () => false,
      ),
      false,
    );
    const restarted = new AudioProjects(root);
    await assert.rejects(restarted.read("rv1909-v2", "jude"), /not found/);
    const stored = await projects.read("rv1909-v2", "jude");
    restarted.hydrate(stored);
    assert.deepEqual(await restarted.read("rv1909-v2", "jude"), stored);
    await fs.mkdir(path.join(root, "rv1909-v6_internal"));
    assert.deepEqual(await projects.nextEdition("rv1909"), {
      number: 7,
      edition: "rv1909-v7",
    });
    await assert.rejects(
      projects.create(version, "rv1909-v3"),
      /next audio version changed/,
    );
    assert.equal(
      await fs.readFile(path.join(root, "rv1909", "original.mp3"), "utf8"),
      "irreplaceable original",
    );
    for (const edition of ["rv1909", "rv1909-v1", "../rv1909-v2", "rv1909-v02"])
      assert.equal(audioEditionSchema.safeParse(edition).success, false);
    for (const number of [2, 9, 10, 19, 20, 100])
      assert.ok(audioEditionSchema.safeParse(`rv1909-v${number}`).success);
  } finally {
    await clean();
  }
});
test("generated editions start at v2 without originals and leave room to import human recordings later", async () => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "audio-without-originals-"),
  );
  try {
    for (const environment of ["production", "development"] as const) {
      const projects = new AudioProjects(root, environment);
      assert.deepEqual(await projects.nextEdition("rv1960"), {
        number: 2,
        edition: "rv1960-v2",
      });
      assert.deepEqual(await projects.nextEdition(version.code), {
        number: 2,
        edition: "rv1909-v2",
      });
      const created = await projects.create(version, "rv1909-v2");
      assert.equal(created.edition, "rv1909-v2");
      assert.equal(created.number, 2);
      assert.ok(created.projects.length > 0);
      for (const name of ["rv1909", "rv1909-v1", "rv1960"]) {
        await assert.rejects(fs.stat(path.join(projects.root, name)), {
          code: "ENOENT",
        });
      }
      for (const edition of ["rv1909", "rv1909-v1"]) {
        await assert.rejects(
          projects.create(version, edition),
          /next audio version changed/,
        );
      }
      // A later import into the reserved original directory must not affect numbering.
      const original = path.join(projects.root, "rv1909");
      await fs.mkdir(original);
      await fs.writeFile(
        path.join(original, "original.mp3"),
        "human recording",
      );
      const restarted = new AudioProjects(root, environment);
      assert.deepEqual(await restarted.nextEdition(version.code), {
        number: 3,
        edition: "rv1909-v3",
      });
      await restarted.create(version, "rv1909-v3");
      assert.equal(
        await fs.readFile(path.join(original, "original.mp3"), "utf8"),
        "human recording",
      );
    }
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test("unowned folders, originals, traversal and symlinked audio cannot be accessed", async () => {
  const { root, projects, clean } = await fixture();
  try {
    await projects.create(version, "rv1909-v2");
    await fs.mkdir(path.join(root, "rv1909-v3_internal"));
    await fs.symlink(path.join(root, "rv1909"), path.join(root, "rv1909-v3"));
    await assert.rejects(projects.read("rv1909-v3", "jude"), /Audio folder/);
    await assert.rejects(projects.read("rv1909", "jude"));
    await assert.rejects(projects.read("rv1909-v2", "../jude"));
    const internal = path.join(root, "rv1909-v2_internal");
    const project = await projects.read("rv1909-v2", "jude");
    project.recordings["1:1"] = {
      file: "linked.mp3",
      duration: 2,
      revision: "1",
    };
    projects.hydrate(project);
    await fs.symlink(
      path.join(root, "rv1909", "original.mp3"),
      path.join(internal, "linked.mp3"),
    );
    await assert.rejects(
      projects.media("rv1909-v2", "jude", 1, 1),
      /Linked audio/,
    );
  } finally {
    await clean();
  }
});
test("generation resumes failures, preserves verses, saves trims and assembles chapter filenames", async () => {
  const { root, projects, clean } = await fixture();
  try {
    await projects.create(version, "rv1909-v2");
    let run!: () => Promise<void>;
    const failing = generation(3);
    await projects.queue(
      "rv1909-v2",
      "jude",
      {},
      (task) => {
        run = task;
      },
      failing.dependencies,
    );
    await assert.rejects(
      projects.queue("rv1909-v2", "jude", {}, () => {}),
      /Wait/,
    );
    const initial = await projects.read("rv1909-v2", "jude");
    await assert.rejects(
      projects.save("rv1909-v2", "jude", {
        revision: initial.revision,
        settings: initial.settings,
      }),
      /Wait/,
    );
    await run();
    const failed = await projects.detail("rv1909-v2", "jude");
    assert.equal(failed.content[0].verses.length, 25);
    assert.equal(failed.status, "failed");
    assert.equal(Object.keys(failed.recordings).length, 2);
    assert.deepEqual(failed.settings.trims["1:1"], {
      startSeconds: 0.17,
      endSeconds: 1.65,
    });
    const first = failed.recordings["1:1"],
      resumed = generation();
    await projects.queue(
      "rv1909-v2",
      "jude",
      {},
      (task) => {
        run = task;
      },
      resumed.dependencies,
    );
    await run();
    const done = await projects.read("rv1909-v2", "jude");
    assert.equal(resumed.count(), 23);
    assert.equal(done.status, "done");
    assert.equal(done.chapters["1"].file, "65-jude-1.mp3");
    assert.deepEqual(done.recordings["1:1"], first);
    assert.match(
      await fs.readFile(await projects.media("rv1909-v2", "jude", 1), "utf8"),
      /:0.17:0.35/,
    );
    const settings = {
      ...done.settings,
      trims: { "1:1": { startSeconds: 0.2, endSeconds: 1.5 } },
      pauses: { "1:1": 0.8 },
    };
    const saved = await projects.save("rv1909-v2", "jude", {
      revision: done.revision,
      settings,
    });
    await assert.rejects(
      projects.save("rv1909-v2", "jude", { revision: done.revision, settings }),
      /Reload/,
    );
    await assert.rejects(
      projects.save("rv1909-v2", "jude", {
        revision: saved.revision,
        settings: {
          ...settings,
          trims: { "1:1": { startSeconds: 0, endSeconds: 3 } },
        },
      }),
      /outside/,
    );
    await projects.queue(
      "rv1909-v2",
      "jude",
      {},
      (task) => {
        run = task;
      },
      resumed.dependencies,
    );
    await run();
    assert.equal(resumed.count(), 23);
    assert.match(
      await fs.readFile(await projects.media("rv1909-v2", "jude", 1), "utf8"),
      /:0.2:0.8/,
    );
    const before = await projects.read("rv1909-v2", "jude");
    await projects.queue(
      "rv1909-v2",
      "jude",
      { chapter: 1, verse: 1, regenerate: true },
      (task) => {
        run = task;
      },
      resumed.dependencies,
    );
    await run();
    const after = await projects.read("rv1909-v2", "jude");
    assert.notEqual(after.recordings["1:1"].revision, first.revision);
    assert.deepEqual(after.settings.trims["1:1"], {
      startSeconds: 0.17,
      endSeconds: 1.65,
    });
    assert.deepEqual(after.recordings["1:2"], before.recordings["1:2"]);
    assert.equal(after.chapters["1"], undefined);
    assert.equal(
      await fs.readFile(path.join(root, "rv1909", "original.mp3"), "utf8"),
      "irreplaceable original",
    );
  } finally {
    await clean();
  }
});
test("unexpected chapter files in owned editions remain protected", async () => {
  const { root, projects, clean } = await fixture();
  try {
    await projects.create(version, "rv1909-v2");
    const file = path.join(root, "rv1909-v2", "65-jude-1.mp3");
    await fs.writeFile(file, "external recording");
    let task!: () => Promise<void>;
    await projects.queue(
      "rv1909-v2",
      "jude",
      {},
      (run) => {
        task = run;
      },
      generation().dependencies,
    );
    await task();
    assert.equal((await projects.read("rv1909-v2", "jude")).status, "failed");
    assert.equal(await fs.readFile(file, "utf8"), "external recording");
  } finally {
    await clean();
  }
});
test("real chapter assembly applies trims and pauses and produces playable MP3", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "audio-chapter-")),
    execute = promisify(execFile);
  try {
    const input = path.join(root, "source.wav"),
      output = path.join(root, "chapter.mp3");
    await execute(config.ffmpegBin, [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=2",
      input,
    ]);
    await assembleAudioChapter(
      [
        {
          file: input,
          trim: { startSeconds: 0.5, endSeconds: 1.5 },
          pause: 0.3,
        },
        { file: input, trim: { startSeconds: 0, endSeconds: 1 }, pause: 0.2 },
      ],
      output,
    );
    const duration = Number(
      (
        await execute(config.ffprobeBin, [
          "-v",
          "error",
          "-show_entries",
          "format=duration",
          "-of",
          "default=noprint_wrappers=1:nokey=1",
          output,
        ])
      ).stdout.trim(),
    );
    assert.ok(
      Math.abs(duration - 2.5) < 0.15,
      `Unexpected duration ${duration}`,
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("video analysis selects generated audio without changing the Bible text", async () => {
  const execute = promisify(execFile);
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "audio-video-library-"));
  try {
    await execute(
      process.execPath,
      [
        "--import",
        "tsx",
        "--input-type=module",
        "-e",
        `
      import fs from 'node:fs/promises'; import path from 'node:path';
      import assert from 'node:assert/strict';
      import { execFile } from 'node:child_process'; import { promisify } from 'node:util';
      import { AudioProjects } from './src/audio-projects.ts';
      import { analyze } from './src/pipeline.ts'; import { settingsSchema } from './src/protocol.ts';
      import { config } from './src/engines/long/config.ts';
      const library = new AudioProjects(path.join(process.env.WORKING_DIR, 'material/audios'));
      await library.create(${JSON.stringify(version)}, 'rv1909-v2');
      const file = path.join(library.root, 'rv1909-v2', '65-jude-1.mp3');
      await promisify(execFile)(config.ffmpegBin, ['-v','error','-f','lavfi','-i','sine=frequency=440:duration=2',file]);
      const development=new AudioProjects(path.join(process.env.WORKING_DIR,'material/audios'),'development');
      await development.create(${JSON.stringify(version)},'rv1909-v2');
      const devFile=path.join(development.root,'rv1909-v2','65-jude-1.mp3');
      await promisify(execFile)(config.ffmpegBin,['-v','error','-f','lavfi','-i','sine=frequency=660:duration=3',devFile]);
      for (const outputEnvironment of ['production','development']) for (const kind of ['short','long','book']) {
        const result = await analyze({ kind,outputEnvironment,
          version: { id:'rv1909', locale:'es', label:'Reina Valera 1909' },
          passage: { id:'jude', book:'jude', start:{chapter:1,verse:1},end:{chapter:1,verse:1} },
          settings: settingsSchema.parse({ audioEdition:'rv1909-v2' }), voiceTemplates:{intro:'',outro:''}
        }, {originalOnly:true});
        assert.equal(result.sections[0].file,outputEnvironment==='development'?devFile:file);
        assert.ok(result.cues[0].text.includes('Judas'));
      }
    `,
      ],
      { env: { ...process.env, WORKING_DIR: root } },
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("development editions, verse jobs and final chapters are isolated from production", async () => {
  const { root, projects: production, clean } = await fixture();
  try {
    const development = new AudioProjects(root, "development");
    await production.create(version, "rv1909-v2");
    assert.equal(
      (await development.nextEdition("rv1909")).edition,
      "rv1909-v2",
    );
    await development.create(version, "rv1909-v2");
    const prodProject = await production.read("rv1909-v2", "jude"),
      devProject = await development.read("rv1909-v2", "jude");
    assert.equal(devProject.outputEnvironment, "development");
    assert.throws(() => development.hydrate(prodProject), /does not match/);
    assert.throws(() => production.hydrate(devProject), /does not match/);
    const jobs: (() => Promise<void>)[] = [];
    await production.queue(
      "rv1909-v2",
      "jude",
      {},
      (job) => jobs.push(job),
      generation().dependencies,
    );
    await development.queue(
      "rv1909-v2",
      "jude",
      {},
      (job) => jobs.push(job),
      generation().dependencies,
    );
    await jobs[0]();
    await jobs[1]();
    assert.equal(
      await production.media("rv1909-v2", "jude", 1),
      path.join(root, "rv1909-v2", "65-jude-1.mp3"),
    );
    assert.equal(
      await development.media("rv1909-v2", "jude", 1),
      path.join(root, "dev", "rv1909-v2", "65-jude-1.mp3"),
    );
    assert.ok(
      (await development.media("rv1909-v2", "jude", 1, 1)).startsWith(
        path.join(root, "dev", "rv1909-v2_internal"),
      ),
    );
    const original = await fs.readFile(
      path.join(root, "rv1909", "original.mp3"),
      "utf8",
    );
    assert.equal(original, "irreplaceable original");
    await fs.mkdir(path.join(root, "rv1909-v9"));
    assert.equal(
      (await development.nextEdition("rv1909")).edition,
      "rv1909-v3",
    );
    assert.equal(
      (await production.nextEdition("rv1909")).edition,
      "rv1909-v10",
    );
  } finally {
    await clean();
  }
});

test("chapter generation exposes every verse and assembly task with live progress", async () => {
  const { projects, clean } = await fixture();
  try {
    await projects.create(version, "rv1909-v2");
    let run!: () => Promise<void>;
    let plan: { chapter: number; verse?: number }[] = [];
    const events: {
      chapter: number;
      verse?: number;
      status: string;
      progress: number;
    }[] = [];
    const generated = generation();
    await projects.queue(
      "rv1909-v2",
      "jude",
      { chapter: 1 },
      (task, tasks) => {
        run = task;
        plan = tasks;
      },
      {
        ...generated.dependencies,
        synthesize: async (...args) => {
          args[4]?.(37);
          await generated.dependencies.synthesize(...args);
        },
        align: async (...args) => {
          args[4](50);
          return generated.dependencies.align(...args);
        },
      },
      undefined,
      (task, status, progress) => events.push({ ...task, status, progress }),
    );
    assert.equal(plan.length, 26);
    assert.deepEqual(plan[0], { chapter: 1, verse: 1 });
    assert.deepEqual(plan.at(-1), { chapter: 1 });
    await run();
    assert.equal(events.filter((event) => event.status === "done").length, 26);
    assert.ok(
      events.some((event) => event.verse === 1 && event.progress === 37 * 0.7),
    );
    assert.ok(
      events.some((event) => event.verse === 1 && event.progress === 85),
    );
    assert.equal((await projects.read("rv1909-v2", "jude")).status, "done");
  } finally {
    await clean();
  }
});

test("distinct verse requests queue together, reject overlapping scopes and preserve every result", async () => {
  const { projects, clean } = await fixture();
  try {
    await projects.create(version, "rv1909-v2");
    const runs: (() => Promise<void>)[] = [];
    const enqueue = (run: () => Promise<void>) => {
      runs.push(run);
    };
    const generated = generation();
    const snapshots: AudioProject[] = [];
    const report = async (project: AudioProject) => {
      snapshots.push(structuredClone(project));
    };
    await projects.queue(
      "rv1909-v2",
      "jude",
      { chapter: 1, verse: 1 },
      enqueue,
      generated.dependencies,
      report,
    );
    await projects.queue(
      "rv1909-v2",
      "jude",
      { chapter: 1, verse: 2 },
      enqueue,
      generated.dependencies,
      report,
      undefined,
      true,
    );
    await assert.rejects(
      projects.queue(
        "rv1909-v2",
        "jude",
        { chapter: 1, verse: 2 },
        enqueue,
        generated.dependencies,
        report,
        undefined,
        true,
      ),
    );
    await assert.rejects(
      projects.queue(
        "rv1909-v2",
        "jude",
        { chapter: 1 },
        enqueue,
        generated.dependencies,
        report,
        undefined,
        true,
      ),
    );
    assert.equal(runs.length, 2);
    await runs[0]();
    const first = await projects.read("rv1909-v2", "jude");
    assert.equal(first.status, "running");
    assert.ok(first.recordings["1:1"]);
    assert.equal(snapshots.at(-1)?.status, "running");
    await runs[1]();
    const final = await projects.read("rv1909-v2", "jude");
    assert.equal(final.status, "draft");
    assert.deepEqual(Object.keys(final.recordings).sort(), ["1:1", "1:2"]);
    assert.deepEqual(final.recordings["1:1"], first.recordings["1:1"]);
    await assert.rejects(
      projects.queue(
        "rv1909-v2",
        "jude",
        { chapter: 1, verse: 3 },
        enqueue,
        generated.dependencies,
        report,
        undefined,
        true,
      ),
    );
  } finally {
    await clean();
  }
});

for (const environment of ["production", "development"] as const) {
  test(
    environment +
      ": alignment gates publication and regeneration preserves prior audio on failure",
    async () => {
      const fixtureData = await fixture();
      const projects = new AudioProjects(fixtureData.root, environment);
      try {
        await projects.create(version, "rv1909-v2");
        const generated = generation();
        const calls: Array<{ text: string; language: string }> = [];
        let run!: () => Promise<void>;
        let fail = false;
        let trim = { startSeconds: 0.1, endSeconds: 1.8 };
        const dependencies: AudioGenerationDependencies = {
          ...generated.dependencies,
          align: async (file, duration, text, language) => {
            assert.equal(await fs.readFile(file, "utf8"), text);
            assert.equal(duration, 2);
            calls.push({ text, language });
            const pending = await projects.read("rv1909-v2", "jude");
            assert.equal(
              pending.recordings["1:1"]?.revision,
              previous?.revision,
            );
            if (fail) throw new Error("test alignment failure");
            return trim;
          },
        };
        let previous: AudioProject["recordings"][string] | undefined;
        const queue = async (regenerate = false) => {
          await projects.queue(
            "rv1909-v2",
            "jude",
            { chapter: 1, verse: 1, regenerate },
            (task) => {
              run = task;
            },
            dependencies,
          );
          await run();
          return projects.detail("rv1909-v2", "jude");
        };
        fail = true;
        const firstFailure = await queue();
        assert.equal(firstFailure.status, "failed");
        assert.equal(firstFailure.recordings["1:1"], undefined);
        assert.equal(firstFailure.settings.trims["1:1"], undefined);
        fail = false;
        const aligned = await queue();
        assert.deepEqual(calls[0], {
          text: aligned.content[0].verses[0].text,
          language: "es",
        });
        assert.deepEqual(aligned.settings.trims["1:1"], trim);
        previous = aligned.recordings["1:1"];
        fail = true;
        const failed = await queue(true);
        assert.equal(failed.status, "failed");
        assert.deepEqual(failed.recordings["1:1"], previous);
        assert.deepEqual(failed.settings.trims["1:1"], trim);
        fail = false;
        trim = { startSeconds: 0.2, endSeconds: 1.6 };
        const regenerated = await queue(true);
        assert.notEqual(
          regenerated.recordings["1:1"].revision,
          previous.revision,
        );
        assert.deepEqual(regenerated.settings.trims["1:1"], trim);
        previous = regenerated.recordings["1:1"];
        for (const invalid of [
          { startSeconds: 0.1, endSeconds: 3 },
          { startSeconds: 1.5, endSeconds: 1.4 },
        ]) {
          trim = invalid;
          const rejected = await queue(true);
          assert.equal(rejected.status, "failed");
          assert.deepEqual(rejected.recordings["1:1"], previous);
          assert.deepEqual(
            rejected.settings.trims["1:1"],
            regenerated.settings.trims["1:1"],
          );
        }
      } finally {
        await fixtureData.clean();
      }
    },
  );
}

test("final audio only assembles saved voices, requires complete chapters and never calls speech models", async () => {
  const { projects, clean } = await fixture();
  try {
    await projects.create(version, "rv1909-v2");
    const original = await projects.read("rv1909-v2", "genesis");
    projects.hydrate({
      ...original,
      chapterCount: 2,
      verseCounts: original.verseCounts.slice(0, 2),
    });
    const detail = await projects.detail("rv1909-v2", "genesis");
    let queued = false;
    const rejectIncomplete = async (chapter?: number) => {
      await assert.rejects(
        projects.queue(
          "rv1909-v2",
          "genesis",
          { chapter, assembleOnly: true },
          () => {
            queued = true;
          },
        ),
        /Generate all verse voices/,
      );
      assert.equal(queued, false);
    };
    await rejectIncomplete(1);
    const fill = (project: AudioProject, chapter: number) => {
      for (const verse of detail.content[chapter - 1].verses) {
        const ref = chapter + ":" + verse.verse;
        project.recordings[ref] = {
          file: "genesis/" + chapter + "-" + verse.verse + ".wav",
          duration: 2,
          revision: "saved",
        };
        project.settings.trims[ref] = { startSeconds: 0.2, endSeconds: 1.5 };
        project.settings.pauses[ref] = 0.8;
      }
      projects.hydrate(project);
    };
    fill(detail, 1);
    await rejectIncomplete();
    let run!: () => Promise<void>;
    let plan: { chapter: number; verse?: number }[] = [];
    const dependencies: AudioGenerationDependencies = {
      ...generation().dependencies,
      synthesize: async () => {
        assert.fail("Final audio must not synthesize voices");
      },
      align: async () => {
        assert.fail("Final audio must not realign voices");
      },
      duration: async () => {
        assert.fail("Final audio must use saved recordings");
      },
    };
    const assemble = async (chapter?: number) => {
      await projects.queue(
        "rv1909-v2",
        "genesis",
        { chapter, assembleOnly: true },
        (task, tasks) => {
          run = task;
          plan = tasks;
        },
        dependencies,
      );
      await run();
      return projects.read("rv1909-v2", "genesis");
    };
    const first = await assemble(1);
    assert.deepEqual(plan, [{ chapter: 1 }]);
    assert.deepEqual(first.recordings, detail.recordings);
    assert.deepEqual(first.settings, detail.settings);
    assert.ok(first.chapters["1"]);
    assert.equal(first.chapters["2"], undefined);
    assert.match(
      await fs.readFile(
        await projects.media("rv1909-v2", "genesis", 1),
        "utf8",
      ),
      /:0.2:0.8/,
    );
    fill(first, 2);
    const all = await assemble();
    assert.deepEqual(plan, [{ chapter: 1 }, { chapter: 2 }]);
    assert.equal(all.status, "done");
    assert.equal(Object.keys(all.chapters).length, 2);
    assert.deepEqual(all.recordings, first.recordings);
    assert.deepEqual(all.settings, first.settings);
  } finally {
    await clean();
  }
});

test("chapter voices generate missing verse recordings without assembling final audio", async () => {
  const { projects, clean } = await fixture();
  try {
    await projects.create(version, "rv1909-v2");
    const generated = generation();
    let run!: () => Promise<void>;
    let plan: { chapter: number; verse?: number }[] = [];
    const dependencies: AudioGenerationDependencies = {
      ...generated.dependencies,
      assemble: async () => {
        assert.fail("Voice generation must not create final audio");
      },
    };
    const queue = async () => {
      await projects.queue(
        "rv1909-v2",
        "jude",
        { chapter: 1, voicesOnly: true },
        (task, tasks) => {
          run = task;
          plan = tasks;
        },
        dependencies,
      );
      await run();
      return projects.read("rv1909-v2", "jude");
    };
    const first = await queue();
    assert.equal(plan.length, 25);
    assert.ok(plan.every((task) => task.chapter === 1 && task.verse));
    assert.equal(generated.count(), 25);
    assert.equal(Object.keys(first.recordings).length, 25);
    assert.deepEqual(first.chapters, {});
    assert.equal(first.status, "draft");
    assert.equal(first.progress, 100);
    const second = await queue();
    assert.equal(generated.count(), 25);
    assert.deepEqual(plan, []);
    assert.deepEqual(second.recordings, first.recordings);
    assert.deepEqual(second.settings.trims, first.settings.trims);
    assert.deepEqual(second.chapters, {});
  } finally {
    await clean();
  }
});

test("chapter analysis realigns only existing voices, preserves recordings and saves completed cuts on failure", async () => {
  const { projects, clean } = await fixture();
  try {
    await projects.create(version, "rv1909-v2");
    let run!: () => Promise<void>;
    const generated = generation();
    for (const verse of [1, 3]) {
      await projects.queue(
        "rv1909-v2",
        "jude",
        { chapter: 1, verse },
        (task) => {
          run = task;
        },
        generated.dependencies,
      );
      await run();
    }
    const before = await projects.detail("rv1909-v2", "jude");
    before.chapters["1"] = {
      file: "65-jude-1.mp3",
      revision: "previous-final",
    };
    before.settings.trims["1:1"] = { startSeconds: 0.4, endSeconds: 1.2 };
    before.settings.trims["1:2"] = { startSeconds: 0.5, endSeconds: 1.4 };
    projects.hydrate(before);
    const calls: string[] = [];
    let fail = false;
    let startSeconds = 0.3;
    const dependencies: AudioGenerationDependencies = {
      ...generated.dependencies,
      synthesize: async () => {
        assert.fail("Analysis must never synthesize voices");
      },
      assemble: async () => {
        assert.fail("Analysis must never assemble final audio");
      },
      align: async (file, duration, text, language, report) => {
        assert.equal(duration, 2);
        assert.equal(language, "es");
        assert.equal(await fs.readFile(file, "utf8"), text);
        calls.push(text);
        if (fail && text === before.content[0].verses[2].text)
          throw new Error("test analysis interruption");
        report(50);
        return { startSeconds, endSeconds: 1.7 };
      },
    };
    let plan: { chapter: number; verse?: number }[] = [];
    const analyze = async (verse?: number) => {
      await projects.queue(
        "rv1909-v2",
        "jude",
        { chapter: 1, verse, alignOnly: true },
        (task, tasks) => {
          run = task;
          plan = tasks;
        },
        dependencies,
      );
      await run();
      return projects.read("rv1909-v2", "jude");
    };
    const aligned = await analyze();
    assert.deepEqual(plan, [
      { chapter: 1, verse: 1 },
      { chapter: 1, verse: 3 },
    ]);
    assert.deepEqual(calls, [
      before.content[0].verses[0].text,
      before.content[0].verses[2].text,
    ]);
    assert.deepEqual(aligned.recordings, before.recordings);
    for (const ref of ["1:1", "1:3"])
      assert.deepEqual(aligned.settings.trims[ref], {
        startSeconds: 0.3,
        endSeconds: 1.7,
      });
    assert.deepEqual(
      aligned.settings.trims["1:2"],
      before.settings.trims["1:2"],
    );
    assert.equal(aligned.chapters["1"], undefined);
    assert.equal(aligned.status, "draft");
    assert.equal(generated.count(), 2);
    startSeconds = 0.25;
    const single = await analyze(1);
    assert.deepEqual(plan, [{ chapter: 1, verse: 1 }]);
    assert.equal(calls.length, 3);
    assert.equal(calls[2], before.content[0].verses[0].text);
    assert.deepEqual(single.recordings, before.recordings);
    assert.deepEqual(single.settings.trims["1:1"], {
      startSeconds: 0.25,
      endSeconds: 1.7,
    });
    assert.deepEqual(
      single.settings.trims["1:2"],
      aligned.settings.trims["1:2"],
    );
    assert.deepEqual(
      single.settings.trims["1:3"],
      aligned.settings.trims["1:3"],
    );
    fail = true;
    startSeconds = 0.2;
    const failed = await analyze();
    assert.equal(failed.status, "failed");
    assert.deepEqual(failed.recordings, before.recordings);
    assert.deepEqual(failed.settings.trims["1:1"], {
      startSeconds: 0.2,
      endSeconds: 1.7,
    });
    assert.deepEqual(
      failed.settings.trims["1:3"],
      aligned.settings.trims["1:3"],
    );
  } finally {
    await clean();
  }
});

test("approving saved voices preserves final audio and regenerated voices need review again", async () => {
  const { projects, clean } = await fixture();
  try {
    await projects.create(version, "rv1909-v2");
    const generated = generation();
    let run!: () => Promise<void>;
    await projects.queue(
      "rv1909-v2",
      "jude",
      {},
      (task) => {
        run = task;
      },
      generated.dependencies,
    );
    await run();
    const before = await projects.read("rv1909-v2", "jude");
    assert.equal(before.status, "done");
    const approved = await projects.save("rv1909-v2", "jude", {
      revision: before.revision,
      settings: {
        ...before.settings,
        approvals: {
          "1:1": audioVerseApproval(before, before.settings, "1:1")!,
        },
      },
    });
    assert.equal(approved.status, "done");
    assert.deepEqual(approved.chapters, before.chapters);
    assert.equal(
      isAudioVerseApproved(approved, approved.settings, "1:1"),
      true,
    );
    await projects.queue(
      "rv1909-v2",
      "jude",
      { chapter: 1, verse: 1, regenerate: true },
      (task) => {
        run = task;
      },
      generated.dependencies,
    );
    await run();
    const regenerated = await projects.read("rv1909-v2", "jude");
    assert.equal(
      isAudioVerseApproved(regenerated, regenerated.settings, "1:1"),
      false,
    );
    assert.deepEqual(
      regenerated.settings.approvals,
      approved.settings.approvals,
    );
  } finally {
    await clean();
  }
});

test("pronunciation adaptations affect one synthesis and alignment without changing saved Bible text", async () => {
  const { projects, clean } = await fixture();
  try {
    await projects.create(version, "rv1909-v2");
    const before = await projects.detail("rv1909-v2", "jude");
    const adapted = "Texto temporal para pronunciar mejor.";
    const spoken: string[] = [];
    const aligned: string[] = [];
    const generated = generation();
    const dependencies: AudioGenerationDependencies = {
      ...generated.dependencies,
      synthesize: async (directory, text, ...args) => {
        spoken.push(text);
        await generated.dependencies.synthesize(directory, text, ...args);
      },
      align: async (file, duration, text, ...args) => {
        aligned.push(text);
        return generated.dependencies.align(file, duration, text, ...args);
      },
    };
    let run!: () => Promise<void>;
    await projects.queue(
      "rv1909-v2",
      "jude",
      { chapter: 1, verse: 1, textOverride: adapted },
      (task) => {
        run = task;
      },
      dependencies,
    );
    await run();
    const adaptedProject = await projects.detail("rv1909-v2", "jude");
    assert.deepEqual(adaptedProject.content, before.content);
    assert.deepEqual(spoken, [adapted]);
    assert.deepEqual(aligned, [adapted]);
    assert.equal(JSON.stringify(adaptedProject).includes(adapted), false);
    const adaptedRevision = adaptedProject.recordings["1:1"].revision;
    await projects.queue(
      "rv1909-v2",
      "jude",
      { chapter: 1, verse: 1, regenerate: true, textOverride: adapted },
      (task) => {
        run = task;
      },
      dependencies,
    );
    await run();
    assert.deepEqual(spoken, [adapted, adapted]);
    assert.deepEqual(aligned, [adapted, adapted]);
    await projects.queue(
      "rv1909-v2",
      "jude",
      { chapter: 1, verse: 1, regenerate: true },
      (task) => {
        run = task;
      },
      dependencies,
    );
    await run();
    const originalAgain = await projects.detail("rv1909-v2", "jude");
    assert.equal(spoken[2], before.content[0].verses[0].text);
    assert.equal(aligned[2], before.content[0].verses[0].text);
    assert.notEqual(originalAgain.recordings["1:1"].revision, adaptedRevision);
    assert.deepEqual(originalAgain.content, before.content);
  } finally {
    await clean();
  }
});
