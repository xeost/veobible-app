/**
 * Remotion animation helpers – pure TypeScript equivalents of the
 * FFmpeg expression functions in motion-design.ts.
 *
 * All time values are in seconds. The frame-level equivalent is obtained
 * by callers via `useCurrentFrame() / fps`.
 */

/** Clamp p to [0,1]. */
export const clamp = (p: number) => Math.max(0, Math.min(1, p));

/** Linear progress 0→1 from `start` over `duration` seconds, clamped. */
export const progress = (t: number, start: number, duration: number): number =>
  clamp((t - start) / Math.max(0.001, duration));

/** Cubic ease-out: fast start, slow finish. */
export const easeOut = (p: number): number => 1 - Math.pow(1 - p, 3);

/** Cubic ease-in: slow start, fast finish. */
export const easeIn = (p: number): number => Math.pow(p, 3);

/** Smooth-step (Hermite): zero derivative at both ends. */
export const smooth = (p: number): number => p * p * (3 - 2 * p);

export interface Phase {
  start: number;
  duration: number;
  exit: number;
  exitDuration: number;
}

/** Combined alpha (0→1→0) for a phase at time t. */
export function phaseAlpha(t: number, phase: Phase): number {
  const enter = smooth(progress(t, phase.start, phase.duration));
  const exit = smooth(progress(t, phase.exit, phase.exitDuration));
  return enter * (1 - exit);
}

/** Y-translation (in artboard pixels) for a text element at time t. */
export function phaseY(
  t: number,
  phase: Phase,
  baseY: number,
  travel = 42,
  exitTravel = 18,
): number {
  const enterP = progress(t, phase.start, phase.duration);
  const exitP = progress(t, phase.exit, phase.exitDuration);
  return baseY + travel * (1 - easeOut(enterP)) - exitTravel * easeIn(exitP);
}

// ─── stage phase helper ──────────────────────────────────────────────────────

const OVERLAY_LIFT = 140; // artboard pixels, matches FFmpeg version

export function positionY(artboardY: number): number {
  return artboardY;
}

export function stagePhase(
  length: number,
  delay: number,
  exitOrder = 0,
): Phase {
  const scale = Math.min(1, length / 4);
  return {
    start: delay * scale,
    duration: 0.65 * scale,
    exit: length - (0.96 + exitOrder) * scale,
    exitDuration: 0.45 * scale,
  };
}

export const introVersionDelay = 0.88;

export function introAnimationEnd(length: number): number {
  const phase = stagePhase(length, introVersionDelay);
  return phase.start + phase.duration;
}

// ─── text layout ─────────────────────────────────────────────────────────────

/** Approximate optical character widths (same weights as FFmpeg version). */
function textWidth(text: string, size: number): number {
  return (
    [...text].reduce((sum, char) => {
      let w = 0.53;
      if (/[\s]/u.test(char)) w = 0.28;
      else if (/[ilI.,:;!''|]/u.test(char)) w = 0.28;
      else if (/[MWmw@]/u.test(char)) w = 0.88;
      else if (/[A-ZÁÉÍÓÚÀÃÕÇ]/u.test(char)) w = 0.67;
      return sum + w;
    }, 0) * size
  );
}

export function fitFontSize(
  text: string,
  size: number,
  maxWidth = 800,
): number {
  return Math.min(size, (size * maxWidth) / Math.max(1, textWidth(text, size)));
}

/** Balanced line-breaking algorithm (identical to the FFmpeg version). */
function balancedLines(text: string, size: number, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/u);
  const n = words.length;
  const costs = Array<number>(n + 1).fill(Infinity);
  const next = Array<number>(n).fill(n);
  costs[n] = 0;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = i + 1; j <= n; j++) {
      const line = words.slice(i, j).join(" ");
      const width = textWidth(line, size);
      if (width > maxWidth && j > i + 1) break;
      const remainder = Math.max(0, maxWidth - width);
      const widow = j === n && j - i === 1 && n > 3 ? maxWidth * maxWidth : 0;
      const cost = remainder * remainder + widow + costs[j];
      if (cost < costs[i]) {
        costs[i] = cost;
        next[i] = j;
      }
    }
  }
  const lines: string[] = [];
  for (let i = 0; i < n; i = next[i])
    lines.push(words.slice(i, next[i]).join(" "));
  return lines;
}

export function layoutVerse(text: string): {
  lines: string[];
  fontSize: number;
} {
  for (let fontSize = 68; fontSize >= 24; fontSize -= 4) {
    const lines = balancedLines(text, fontSize, 1600);
    if (lines.length * fontSize * 1.28 <= 500 || fontSize === 24) {
      return { lines, fontSize };
    }
  }
  throw new Error("Could not lay out verse");
}

export function wrapIntroTitle(title: string): string[] {
  const known: Record<string, string[]> = {
    "Esta es tu dosis diaria de la palabra de Dios": [
      "Esta es tu",
      "dosis diaria",
      "de la palabra de Dios",
    ],
    "This is your daily dose of the word of God": [
      "This is your",
      "daily dose",
      "of the word of God",
    ],
    "Esta é a sua dose diária da palavra de Deus": [
      "Esta é a sua",
      "dose diária",
      "da palavra de Deus",
    ],
  };
  const series: Record<string, string[]> = {
    "La Biblia en 365 días": [
      "La Biblia en",
      "365 días",
      "Un recorrido por la palabra de Dios",
    ],
    "The Bible in 365 days": [
      "The Bible in",
      "365 days",
      "A journey through the word of God",
    ],
    "A Bíblia em 365 dias": [
      "A Bíblia em",
      "365 dias",
      "Uma jornada pela palavra de Deus",
    ],
  };
  return series[title] ?? known[title] ?? balancedLines(title, 92, 1600);
}

// ─── verse text phases ────────────────────────────────────────────────────────

export { verseTextPhases } from "../../../verse-animation";
