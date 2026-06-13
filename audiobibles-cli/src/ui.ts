/**
 * UI helpers — shared styled primitives for terminal output.
 */
import chalk from "chalk";
import boxen from "boxen";

// ─── Brand palette ───────────────────────────────────────────────────────────

export const C = {
  primary: chalk.hex("#A78BFA"),      // violet
  accent: chalk.hex("#34D399"),       // emerald
  warn: chalk.hex("#FBBF24"),         // amber
  danger: chalk.hex("#F87171"),       // rose
  muted: chalk.hex("#6B7280"),        // gray
  bold: chalk.bold,
  dim: chalk.dim,
  white: chalk.white,
  cyan: chalk.cyan,
  magenta: chalk.magenta,
};

// ─── Banner ──────────────────────────────────────────────────────────────────

export function printBanner(): void {
  const heading = chalk.hex("#C4B5FD").bold("Audiobible Production Assistant");
  const rule    = chalk.hex("#6D28D9")("━".repeat(32));
  const url     = chalk.hex("#34D399")("veobible.com");
  const tag     = chalk.hex("#6B7280")("  ·  Professional Tools");

  const content = `${heading}\n${rule}\n${url}${tag}`;

  console.log(
    boxen(content, {
      padding: { top: 1, bottom: 1, left: 4, right: 4 },
      borderStyle: "double",
      borderColor: "#7C3AED",
      title: chalk.hex("#A78BFA").bold(" AUDIOBIBLES ") + chalk.hex("#34D399").bold("CLI "),
      titleAlignment: "center",
      dimBorder: false,
    })
  );
}

// ─── Screen utilities ─────────────────────────────────────────────────────────

/**
 * Clears the visible terminal area without erasing the scrollback buffer.
 * \x1b[2J  → erase visible screen
 * \x1b[H   → move cursor to top-left
 */
export function clearScreen(): void {
  process.stdout.write("\x1b[2J\x1b[H");
}

// ─── Step header ─────────────────────────────────────────────────────────────

export function printStep(num: number, label: string): void {
  clearScreen();
  console.log("\n" + C.primary.bold(`  ── Step ${num} ──`) + C.white.bold(` ${label}`));
}

// ─── Success / error / info ──────────────────────────────────────────────────

export function ok(msg: string): void {
  console.log(C.accent("  ✔  ") + C.white(msg));
}

export function warn(msg: string): void {
  console.log(C.warn("  ⚠  ") + C.white(msg));
}

export function err(msg: string): void {
  console.log(C.danger("  ✖  ") + C.white(msg));
}

export function info(msg: string): void {
  console.log(C.muted("  ·  ") + C.white(msg));
}

// ─── Formatting helpers ──────────────────────────────────────────────────────

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(" ");
}

// ─── Section divider ─────────────────────────────────────────────────────────

export function divider(): void {
  console.log(C.muted("  " + "─".repeat(52)));
}

// ─── Clipboard notice ────────────────────────────────────────────────────────

export function clipboardNotice(label: string, value: string): void {
  console.log(
    C.accent("  📋 Copied: ") + C.primary.bold(label)
  );
  console.log(C.muted("     ") + C.dim(value.slice(0, 80) + (value.length > 80 ? "…" : "")));
}

// ─── Readiness table ─────────────────────────────────────────────────────────

export interface ReadinessRow {
  label: string;
  hasAudios: boolean;
  missingChapters: number[];
  hasImage: boolean;
  ready: boolean;
}

export function printReadinessTable(rows: ReadinessRow[]): void {
  console.log();
  const header =
    C.muted("  Book".padEnd(28)) +
    C.muted("Audios".padEnd(12)) +
    C.muted("Image".padEnd(10)) +
    C.muted("Ready");
  console.log(header);
  console.log(C.muted("  " + "─".repeat(54)));

  for (const r of rows) {
    const tick = (v: boolean) => (v ? C.accent("✔") : C.danger("✖"));
    const ready = r.ready ? C.accent.bold("YES") : C.danger.bold("NO");

    const audioText = r.hasAudios
      ? "✔"
      : `✖ (ch. ${r.missingChapters.slice(0, 3).join(",")}${r.missingChapters.length > 3 ? "…" : ""} missing)`;

    const audioStatus = r.hasAudios
      ? tick(true)
      : tick(false) + C.danger(` (ch. ${r.missingChapters.slice(0, 3).join(",")}${r.missingChapters.length > 3 ? "…" : ""} missing)`);

    const colLabel  = C.white(r.label.slice(0, 24).padEnd(26));
    const colAudio  = audioStatus + " ".repeat(Math.max(0, 12 - audioText.length));
    const colImage  = tick(r.hasImage) + " ".repeat(9);

    console.log(`  ${colLabel}${colAudio}${colImage}${ready}`);
  }
  console.log();
}
