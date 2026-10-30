/** Group consecutive verses within a conservative Qwen speech budget. */
export function audioSpeechBlocks<
  T extends { chapter: number; verse: number; text: string },
>(verses: T[], maxWords = 160): T[][] {
  const blocks: T[][] = [];
  let block: T[] = [],
    words = 0;
  for (const verse of verses) {
    const count = verse.text.trim().split(/\s+/).length;
    const previous = block.at(-1);
    if (
      previous &&
      (previous.chapter !== verse.chapter ||
        previous.verse + 1 !== verse.verse ||
        words + count > maxWords)
    ) {
      blocks.push(block);
      block = [];
      words = 0;
    }
    block.push(verse);
    words += count;
  }
  if (block.length) blocks.push(block);
  return blocks;
}
