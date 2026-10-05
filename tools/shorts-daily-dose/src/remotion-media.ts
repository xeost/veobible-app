import fs from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import type { ShortCompositionProps } from "./remotion/types.js";

/** Publish only this render's media in the bundle's served public directory. */
export async function prepareRemotionMedia(bundleDir: string, props: ShortCompositionProps): Promise<{ props: ShortCompositionProps; cleanup: () => Promise<void> }> {
  const publicDir = path.join(bundleDir, "public");
  await fs.mkdir(publicDir, { recursive: true });
  const directory = await fs.mkdtemp(path.join(publicDir, "render-media-"));
  const cleanup = () => fs.rm(directory, { recursive: true, force: true });
  try {
    const sources = [...new Set([
      props.introVideoPath, props.boomerangVideoPath, props.outroVideoPath,
      ...props.sections.map(section => section.file),
      ...(props.voices ? [props.voices.intro, props.voices.outro] : [])
    ].map(source => path.resolve(source)))];
    const assets = new Map<string, string>();
    const copies = await Promise.allSettled(sources.map(async (source, index) => {
      const name = `asset-${index}${path.extname(source)}`;
      await fs.copyFile(source, path.join(directory, name), constants.COPYFILE_FICLONE);
      assets.set(source, `${path.basename(directory)}/${name}`);
    }));
    const failures = copies.filter((copy): copy is PromiseRejectedResult => copy.status === "rejected");
    if (failures.length) throw failures[0].reason;
    const asset = (source: string) => assets.get(path.resolve(source))!;
    return {
      props: {
        ...props,
        introVideoPath: asset(props.introVideoPath),
        boomerangVideoPath: asset(props.boomerangVideoPath),
        outroVideoPath: asset(props.outroVideoPath),
        sections: props.sections.map(section => ({ ...section, file: asset(section.file) })),
        voices: props.voices ? { ...props.voices, intro: asset(props.voices.intro), outro: asset(props.voices.outro) } : undefined
      },
      cleanup
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
