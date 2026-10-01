import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import type { IntroTitle, OutroTitle } from "./video.js";
import type { VerseCue } from "./verse-timing.js";
import type { RGB } from "./background-palette.js";

// Layout coordinates describe a 1080 × 1920 artboard. Keep text inside the
// central safe area, clear of the usual short-video controls and captions.
const palette = { paper: "0xFFF8EA", gold: "0xE8C68A", muted: "0xCFD4D0", ink: "0x101B1C" };
const readingInk = { body: "0x182320", accent: "0x493A29" };
const overlayLift = 140;
const italicFile = "/System/Library/Fonts/Supplemental/Georgia Italic.ttf";
const italic = existsSync(italicFile) ? `fontfile='${italicFile}'` : "font=Georgia";
const serif = "font=Georgia";
const sans = "font=Avenir";
const sansSemibold = "font='Avenir Next Demi Bold'";
const number = (value: number) => Number(value.toFixed(5));
const escapeExpression = (value: string) => value.replaceAll(",", "\\,");
const progress = (start: number, duration: number) => `clip((t-${number(start)})/${number(Math.max(0.001, duration))},0,1)`;
const easeOut = (p: string) => `(1-pow(1-${p},3))`;
const easeIn = (p: string) => `pow(${p},3)`;
const smooth = (p: string) => `(${p}*${p}*(3-2*${p}))`;

interface Phase { start: number; duration: number; exit: number; exitDuration: number }

/** Approximate optical widths, rather than counting all letters equally. */
function textWidth(text: string, size: number): number {
  return [...text].reduce((sum, char) => sum + (
    /[\s]/u.test(char) ? 0.28 : /[ilI.,:;!'’|]/u.test(char) ? 0.28 : /[MWmw@]/u.test(char) ? 0.88 : /[A-ZÁÉÍÓÚÀÃÕÇ]/u.test(char) ? 0.67 : 0.53
  ), 0) * size;
}

function fit(text: string, size: number, width = 800): number {
  return Math.min(size, size * width / Math.max(1, textWidth(text, size)));
}

/** Balanced lines avoid a single short word stranded at the end of a verse. */
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
      if (cost < costs[i]) { costs[i] = cost; next[i] = j; }
    }
  }
  const lines: string[] = [];
  for (let i = 0; i < n; i = next[i]) lines.push(words.slice(i, next[i]).join(" "));
  return lines;
}

export function layoutVerse(text: string): { text: string; fontSize: number } {
  for (let fontSize = 72; fontSize >= 24; fontSize -= 4) {
    const lines = balancedLines(text, fontSize, 800);
    if (lines.length * fontSize * 1.28 <= 720 || fontSize === 24) return { text: lines.join("\n"), fontSize };
  }
  throw new Error("Could not lay out verse");
}

export function wrapIntroTitle(title: string): string {
  const known: Record<string, string[]> = {
    "Esta es tu dosis diaria de la palabra de Dios": ["Esta es tu", "dosis diaria", "de la palabra de Dios"],
    "This is your daily dose of the word of God": ["This is your", "daily dose", "of the word of God"],
    "Esta é a sua dose diária da palavra de Deus": ["Esta é a sua", "dose diária", "da palavra de Deus"]
  };
  return (known[title] ?? balancedLines(title, 92, 800)).join("\n");
}

/** All entrance and exit phases adapt to short clips, without changing media timing. */
function stagePhase(length: number, delay: number, exitOrder = 0): Phase {
  const scale = Math.min(1, length / 4);
  return { start: delay * scale, duration: 0.65 * scale, exit: length - (0.96 + exitOrder) * scale, exitDuration: 0.45 * scale };
}

class Graphics {
  private serial = 0;
  constructor(private width: number, private height: number, private directory: string) {}
  x(value: number): number { return Math.round(value * this.width / 1080); }
  y(value: number): number { return Math.round(value * this.height / 1920); }
  positionY(value: number): number { return this.y(value - overlayLift); }

  async text(value: string, x: number, y: number, size: number, font: string, color: string, phase: Phase, travel = 42, width = 800, shadow = 0.28): Promise<string> {
    const file = path.join(this.directory, `design-${this.serial++}.txt`);
    await fs.writeFile(file, value, "utf8");
    const enter = progress(phase.start, phase.duration);
    const exit = progress(phase.exit, phase.exitDuration);
    const alpha = escapeExpression(`${smooth(enter)}*(1-${smooth(exit)})`);
    const position = escapeExpression(`${this.positionY(y)}+${this.y(travel)}*(1-${easeOut(enter)})-${this.y(18)}*${easeIn(exit)}`);
    const pixels = Math.max(1, Math.round(fit(value, size, width) * this.width / 1080));
    return `drawtext=${font}:textfile='${file}':expansion=none:fontsize=${pixels}:fontcolor=${color}:x=${this.x(x)}:y='${position}':alpha='${alpha}':shadowcolor=0x07100D@${shadow}:shadowx=0:shadowy=${Math.max(1, this.y(2))}`;
  }

  // Build the alpha ramp at 2 × 256, then interpolate it to the artboard. Drawing
  // wide bands directly at output resolution would leave visible steps.
  scrim(): string[] {
    const count = 256;
    return Array.from({ length: count }, (_, index) => {
      const t = (index + 0.5) / count + overlayLift / 1920;
      const top = Math.min(1, Math.max(0, (t - 0.09) / 0.16));
      // Clear the book in the bottom quarter, including the soft gradient tail.
      const bottom = Math.min(1, Math.max(0, (0.81 - t) / 0.18));
      const opacity = 0.8 * (top * top * (3 - 2 * top)) * (bottom * bottom * (3 - 2 * bottom));
      return `drawbox=x=0:y=${index}:w=iw:h=1:color=${palette.ink}@${opacity.toFixed(4)}:t=fill:replace=1`;
    });
  }

  base(input: string, label: string, length: number, rate: string, phase: Phase): string[] {
    return [
      `color=c=black@0.0:s=2x256:r=${rate}:d=${length.toFixed(6)},format=rgba,${this.scrim().join(",")},scale=${this.width}:${this.height}:flags=bilinear,setsar=1,fade=t=in:st=${phase.start.toFixed(5)}:d=${phase.duration.toFixed(5)}:alpha=1,fade=t=out:st=${phase.exit.toFixed(5)}:d=${phase.exitDuration.toFixed(5)}:alpha=1[${label}scrim]`,
      `[${input}][${label}scrim]overlay=0:0:format=auto:shortest=1,format=yuv420p[${label}base]`
    ];
  }

  /** Drifting elliptical fields blend sampled hues without linear gradient bands. */
  chromaticBase(input: string, label: string, length: number, rate: string, phase: Phase, colors: RGB[]): string[] {
    const fields = [
      [0.18, 0.28, 0.5, 0.28, 0], [0.8, 0.35, 0.46, 0.32, 1.7],
      [0.28, 0.64, 0.48, 0.3, 3.1], [0.82, 0.7, 0.52, 0.26, 4.8]
    ].map(([x, y, sx, sy, offset]) =>
      `exp(-2*(pow((X/W-(${x}+0.14*sin(T/13+${offset})))/${sx},2)+pow((Y/H-(${y}+0.09*cos(T/17+${offset})))/${sy},2)))`
    );
    const total = `(${fields.join("+")})`;
    const channel = (index: number) => `(${fields.map((field, i) => `${colors[i % colors.length][index]}*${field}`).join("+")})/${total}`;
    // Cover the entire frame: strongest behind the text and footer, with
    // smooth ramps to a faint tint at both edges instead of transparent gaps.
    const top = `clip(Y/H/0.17,0,1)`;
    const bottom = `clip((1-Y/H)/0.26,0,1)`;
    const alpha = `255*0.60*(0.20+0.80*${smooth(top)}*${smooth(bottom)})`;
    return [
      `color=c=black@0:s=96x160:r=${rate}:d=${length.toFixed(6)},format=gbrap,geq=r='${channel(0)}':g='${channel(1)}':b='${channel(2)}':a='${alpha}',format=rgba,scale=${this.width}:${this.height}:flags=bilinear,setsar=1,fade=t=in:st=${phase.start.toFixed(5)}:d=${phase.duration.toFixed(5)}:alpha=1,fade=t=out:st=${phase.exit.toFixed(5)}:d=${phase.exitDuration.toFixed(5)}:alpha=1[${label}scrim]`,
      `[${input}][${label}scrim]overlay=0:0:format=auto:shortest=1,format=yuv420p[${label}base]`
    ];
  }

  /** The gold stroke draws itself from the left, then retracts during exit. */
  rule(input: string, label: string, length: number, rate: string, x: number, y: number, width: number, phase: Phase, color = palette.gold): string[] {
    const pixels = Math.max(2, this.x(width));
    const position = escapeExpression(`-${pixels}+${pixels}*${easeOut(progress(phase.start, phase.duration))}*(1-${easeIn(progress(phase.exit, phase.exitDuration))})`);
    const thickness = Math.max(2, this.y(3));
    return [
      `color=c=black@0:s=${pixels}x${thickness}:r=${rate}:d=${length.toFixed(6)},format=rgba[${label}mask]`,
      `color=c=${color}:s=${pixels}x${thickness}:r=${rate}:d=${length.toFixed(6)},format=rgba[${label}fill]`,
      `[${label}mask][${label}fill]overlay=x='${position}':y=0:format=auto:shortest=1,fade=t=in:st=${phase.start.toFixed(5)}:d=${phase.duration.toFixed(5)}:alpha=1,fade=t=out:st=${phase.exit.toFixed(5)}:d=${phase.exitDuration.toFixed(5)}:alpha=1[${label}stroke]`,
      `[${input}][${label}stroke]overlay=x=${this.x(x)}:y=${this.positionY(y)}:format=auto:shortest=1,format=yuv420p[${label}]`
    ];
  }
}

export async function createStageGraphics(options: {
  width: number; height: number; rate: string; staging: string;
  intro: IntroTitle; outro: OutroTitle; cues: VerseCue[];
  introLength: number; readingLength: number; outroLength: number; readingSilence: number;
  readingPalette?: RGB[];
}): Promise<{ intro: string[]; reading: string[]; outro: string[] }> {
  const { width, height, rate, staging, intro, outro, cues, introLength, readingLength, outroLength, readingSilence } = options;
  const g = new Graphics(width, height, staging);
  const introPhase = (delay: number, exitOrder = 0) => stagePhase(introLength, delay, exitOrder);
  const introLines = wrapIntroTitle(intro.title).split("\n");
  const introText = await Promise.all([
    g.text("V E O B I B L E", 116, 420, 25, sans, palette.gold, introPhase(0.05, 0.04), 20),
    g.text(introLines.length === 3 ? introLines[0] : "", 116, 565, 42, sans, palette.paper, introPhase(0.16), 30),
    g.text(introLines.length === 3 ? introLines[1] : introLines[0], 108, 650, 128, italic, palette.gold, introPhase(0.3), 72),
    g.text(introLines.length === 3 ? introLines[2] : introLines.slice(1).join(" "), 116, 822, 48, serif, palette.paper, introPhase(0.5, 0.04)),
    g.text(intro.reference, 112, 1060, 82, serif, palette.paper, introPhase(0.72, 0.13)),
    g.text(intro.version, 116, 1180, 31, sans, palette.muted, introPhase(0.88, 0.22))
  ]);
  const introGraph = [
    ...g.base("v0base", "introDesign", introLength, rate, introPhase(0)),
    ...g.rule("introDesignbase", "introRule", introLength, rate, 116, 984, 108, introPhase(0.6, 0.1)),
    `[introRule]${introText.join(",")}[v0]`
  ];

  const readingPhase: Phase = { start: Math.max(0, readingSilence - 0.3), duration: 0.45, exit: readingLength - readingSilence, exitDuration: 0.4 };
  const readingText: string[] = [];
  for (const cue of cues) {
    const length = cue.end - cue.start;
    const scale = Math.min(1, length / 2.5);
    const start = readingSilence + cue.start;
    const end = readingSilence + cue.end;
    const layout = layoutVerse(cue.text);
    const lines = layout.text.split("\n");
    const lineHeight = layout.fontSize * 1.28;
    const top = 695 + (720 - lines.length * lineHeight) / 2;
    const phase = (delay: number, order = 0): Phase => ({ start: start + delay * scale, duration: 0.46 * scale, exit: end - (0.38 + order) * scale, exitDuration: 0.32 * scale });
    readingText.push(await g.text(cue.reference, 116, 476, 36, sans, readingInk.accent, phase(0), 24, 800, 0));
    readingText.push(await g.text("“", 106, 619, 106, serif, readingInk.accent, phase(0.09), 20, 800, 0));
    for (let index = 0; index < lines.length; index++) {
      readingText.push(await g.text(lines[index], 116, top + index * lineHeight, layout.fontSize, serif, readingInk.body, phase(0.16 + index * 0.055, (lines.length - index - 1) * 0.015), 34, 800, 0));
    }
  }
  readingText.push(await g.text("V E O B I B L E . C O M", 116, 1510, 24, sansSemibold, readingInk.body, readingPhase, 10, 800, 0));
  const readingGraph = [
    ...g.chromaticBase("v1base", "readingDesign", readingLength, rate, readingPhase, options.readingPalette?.length ? options.readingPalette : [[246, 236, 216], [222, 236, 226], [240, 224, 210], [220, 232, 242]]),
    ...g.rule("readingDesignbase", "readingRule", readingLength, rate, 116, 551, 96, readingPhase, readingInk.accent),
    `[readingRule]${readingText.join(",")}[v1]`
  ];

  const outroPhase = (delay: number, exitOrder = 0) => stagePhase(outroLength, delay, exitOrder);
  const outroText = await Promise.all([
    g.text("V E O B I B L E", 116, 320, 25, sans, palette.gold, outroPhase(0.02), 20),
    g.text(outro.title, 108, 445, 128, italic, palette.gold, outroPhase(0.16), 72),
    g.text(outro.highlight, 116, 605, 58, serif, palette.paper, outroPhase(0.35)),
    g.text(outro.channel, 116, 784, 37, sans, palette.paper, outroPhase(0.55, 0.06))
  ]);
  for (let index = 0; index < outro.social.length; index++) {
    const row = outro.social[index];
    const y = 910 + index * 114;
    const phase = outroPhase(0.7 + index * 0.13, (outro.social.length - index) * 0.025);
    outroText.push(await g.text(row.platform.toUpperCase(), 116, y, 21, sans, palette.gold, phase, 24));
    outroText.push(await g.text(row.handle, 116, y + 35, 37, sans, palette.paper, { ...phase, start: phase.start + 0.05 * Math.min(1, outroLength / 4) }, 30));
  }
  outroText.push(await g.text(outro.website, 112, 1418, 54, serif, palette.gold, outroPhase(1.2, 0.18), 26));
  const outroGraph = [
    ...g.base("v2base", "outroDesign", outroLength, rate, outroPhase(0)),
    ...g.rule("outroDesignbase", "outroRule", outroLength, rate, 116, 730, 108, outroPhase(0.42)),
    `[outroRule]${outroText.join(",")}[v2]`
  ];
  return { intro: introGraph, reading: readingGraph, outro: outroGraph };
}
