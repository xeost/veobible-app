/**
 * UI helpers — shared styled primitives for terminal output.
 */
import chalk from "chalk";
import boxen from "boxen";
import readline from "readline";

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

// ─── Generic numbered menu ────────────────────────────────────────────────────

export interface NumberedMenuItem<T> {
  label: string;
  value: T;
}

/**
 * Renders a numbered list menu in raw TTY mode and returns the selected value.
 *
 * Keys handled:
 *   ↑ / ↓     — move selection
 *   Enter      — confirm selection
 *   0–9        — jump to item (if valid) + confirm after 120 ms flash
 *   Ctrl+C     — exit process
 *
 * The zero-item is always the back/cancel action passed as `cancelLabel`.
 * `cancelLabel` defaults to "Back".
 *
 * @param title        - Header line shown above the options.
 * @param items        - Ordered list of choices (displayed as 1, 2, 3 …).
 * @param cancelLabel  - Label for the 0 key (back / exit / cancel).
 * @returns The `.value` of the selected item, or `null` when 0 is pressed.
 */
export function showNumberedMenu<T>(
  title: string,
  items: NumberedMenuItem<T>[],
  cancelLabel = "Back"
): Promise<T | null> {
  return new Promise((resolve) => {
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.resume();

    // All entries including the cancel row (at index 0).
    // Display index 0 = cancel; display index 1…N = items.
    let selectedDisplay = 1; // 1-based display index (1 = first item)

    function render() {
      console.log();
      console.log(C.primary.bold(`  ${title}`));
      console.log();

      for (let d = 1; d <= items.length; d++) {
        const selected = d === selectedDisplay;
        const marker = selected ? C.accent("❯ ") : "  ";
        const keyStr = C.white.bold(`${d}.`);
        const labelStr = selected
          ? C.white.bold(items[d - 1].label)
          : C.white(items[d - 1].label);
        console.log(`${marker}${keyStr} ${labelStr}`);
      }

      // Cancel row (0)
      const cancelSelected = selectedDisplay === 0;
      const cancelMarker = cancelSelected ? C.accent("❯ ") : "  ";
      console.log(
        `${cancelMarker}${C.danger.bold("0.")} ${cancelSelected ? C.danger.bold(cancelLabel) : C.danger(cancelLabel)}`
      );

      console.log();
      console.log(C.muted("  ↑↓ navigate  ·  enter select  ·  0–9 shortcut"));
    }

    // Save cursor, draw initial menu.
    process.stdout.write("\x1b7");
    render();

    function redraw() {
      process.stdout.write("\x1b8\x1b[J");
      render();
    }

    function cleanup() {
      process.stdin.off("data", onData);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdin.pause();
    }

    function confirm() {
      // Erase the menu so it does not remain visible behind the step output.
      process.stdout.write("\x1b8\x1b[J");
      cleanup();
      if (selectedDisplay === 0) {
        resolve(null);
      } else {
        resolve(items[selectedDisplay - 1].value);
      }
    }

    const onData = (data: Buffer) => {
      // Arrow up
      if (data.length === 3 && data[0] === 0x1b && data[1] === 0x5b && data[2] === 0x41) {
        selectedDisplay = selectedDisplay <= 0
          ? items.length
          : selectedDisplay - 1;
        redraw();
        return;
      }
      // Arrow down
      if (data.length === 3 && data[0] === 0x1b && data[1] === 0x5b && data[2] === 0x42) {
        selectedDisplay = selectedDisplay >= items.length
          ? 0
          : selectedDisplay + 1;
        redraw();
        return;
      }
      // Enter
      if (data[0] === 0x0d || data[0] === 0x0a) {
        confirm();
        return;
      }
      // Ctrl+C
      if (data[0] === 0x03) {
        cleanup();
        process.stdout.write("\n");
        process.exit(0);
      }
      // Digit 0
      if (data[0] === 0x30) {
        selectedDisplay = 0;
        redraw();
        setTimeout(confirm, 120);
        return;
      }
      // Digits 1–9
      if (data[0] >= 0x31 && data[0] <= 0x39) {
        const d = data[0] - 0x30;
        if (d <= items.length) {
          selectedDisplay = d;
          redraw();
          setTimeout(confirm, 120);
        }
        return;
      }
    };

    process.stdin.on("data", onData);
  });
}

// ─── Press-any-key gate ───────────────────────────────────────────────

/**
 * Prints a short prompt and blocks until the user presses any key.
 * Useful after a step completes so the user can read the output before
 * the terminal is cleared for the next menu.
 */
export function pressAnyKey(
  msg = "Press any key to return to menu..."
): Promise<void> {
  return new Promise((resolve) => {
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdout.write(C.muted(`  ${msg}`));

    const onData = () => {
      process.stdin.off("data", onData);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      resolve();
    };

    process.stdin.once("data", onData);
  });
}
