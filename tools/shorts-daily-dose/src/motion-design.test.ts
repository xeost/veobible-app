import assert from "node:assert/strict";
import test from "node:test";
import { verseTextPhases } from "./remotion/animation.js";

test("smooth verse transitions finish entirely before the audio boundary without overlapping texts", () => {
  for (const lengths of [[8, 6, 9], [0.15, 0.2, 0.1], [10, 0.12, 12]]) {
    let end = 0;
    const cues = lengths.map((length, index) => {
      const start = end;
      end += length;
      return { reference: `John 1:${index + 1}`, text: "Verse", start, end };
    });
    const phases = cues.map((_, index) => verseTextPhases(cues, [3, 8, 5], index, 1));
    for (let index = 0; index < cues.length - 1; index++) {
      const boundary = 1 + cues[index].end;
      const outgoingStart = Math.min(...phases[index].map(phase => phase.exit));
      const outgoingEnd = Math.max(...phases[index].map(phase => phase.exit + phase.exitDuration));
      const incomingStart = Math.min(...phases[index + 1].map(phase => phase.start));
      const incomingEnd = Math.max(...phases[index + 1].map(phase => phase.start + phase.duration));
      assert.ok(outgoingStart < outgoingEnd && outgoingEnd < boundary);
      assert.ok(Math.abs(outgoingEnd - incomingStart) < 1e-9, "The incoming text follows the outgoing fade without overlap or a blank gap");
      assert.ok(Math.abs(incomingEnd - boundary) < 1e-9, "All incoming lines are fully visible when their audio starts");
      assert.ok(Math.min(...phases[index + 1].map(phase => phase.duration)) > Math.max(...phases[index].map(phase => phase.exitDuration)), "Incoming fades retain their full smooth duration instead of being compressed to 10 percent");
      assert.ok(incomingEnd - outgoingStart <= Math.min(lengths[index], lengths[index + 1]) / 2 + 1e-9);
    }
    for (const versePhases of phases) for (const phase of versePhases) {
      assert.ok(phase.duration > 0 && phase.exitDuration > 0);
      assert.ok(phase.start + phase.duration < phase.exit, "Short verses retain a fully visible interval");
    }
  }
});
