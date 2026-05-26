#!/usr/bin/env node
/**
 * Entry point for the Audiobibles CLI.
 */
import readline from "readline";
import { printBanner, ok, divider, C, info, clearScreen } from "./ui.js";
import { purgeOldLogs, log } from "./logger.js";
import { runStep0 } from "./steps/step0-setup.js";
import { runStep1 } from "./steps/step1-json.js";
import { runStep2 } from "./steps/step2-image-prompt.js";
import { runStep3 } from "./steps/step3-verify.js";
import { runStep4 } from "./steps/step4-generate.js";

// ── Menu items ────────────────────────────────────────────────────────────────

const MENU_ITEMS = [
  { key: "1", label: "Create Book JSON files",         value: 1 },
  { key: "2", label: "Copy Image Prompts (Gemini)",    value: 2 },
  { key: "3", label: "Verify Source Files",            value: 3 },
  { key: "4", label: "Generate Videos (FFmpeg)",       value: 4 },
  { key: "0", label: "Exit program",                   value: 0 },
];

// ── Menu renderer ─────────────────────────────────────────────────────────────

function renderMenu(defaultBook: number, versionLabel: string, selectedIdx: number): void {
  printBanner();
  console.log();
  console.log(C.muted("  Version: ") + C.accent.bold(versionLabel));
  console.log(C.muted("  Default book: ") + C.accent.bold(String(defaultBook)));
  console.log();
  console.log(C.primary.bold("  Main Menu — Choose the next step:"));
  console.log();

  for (let i = 0; i < MENU_ITEMS.length; i++) {
    const item = MENU_ITEMS[i];
    const selected = i === selectedIdx;
    const marker = selected ? C.accent("❯ ") : "  ";
    const isExit = item.value === 0;
    const keyStr  = isExit ? C.danger.bold(item.key + ".") : C.white.bold(item.key + ".");
    const labelStr = isExit
      ? C.danger(item.label)
      : selected ? C.white.bold(item.label) : C.white(item.label);
    console.log(`${marker}${keyStr} ${labelStr}`);
  }

  console.log();
  console.log(C.muted("  ↑↓ navigate  ·  enter select  ·  0–4 shortcut  ·  ⌫ clear screen"));
}

// ── Interactive menu (raw stdin) ──────────────────────────────────────────────

/**
 * Renders the menu and handles keyboard input in raw mode.
 *
 * Keys handled:
 *   ↑ / ↓         — move selection
 *   Enter          — confirm selection
 *   0–4            — jump to item and confirm after 120 ms (visual flash)
 *   Backspace/DEL  — resolve with "clear"
 *   Ctrl+C         — exit process
 */
function showMenu(
  defaultBook: number,
  versionLabel: string,
  lastChoice: number
): Promise<number | "clear"> {
  return new Promise((resolve) => {
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.resume();

    let selectedIdx = Math.max(0, MENU_ITEMS.findIndex((i) => i.value === lastChoice));

    // \x1b7 saves the cursor position so we can redraw the menu in-place.
    process.stdout.write("\x1b7");
    renderMenu(defaultBook, versionLabel, selectedIdx);

    function redraw() {
      // \x1b8 restores cursor; \x1b[J clears from cursor to end of screen.
      process.stdout.write("\x1b8\x1b[J");
      renderMenu(defaultBook, versionLabel, selectedIdx);
    }

    function cleanup() {
      process.stdin.off("data", onData);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdin.pause();
    }

    const onData = (data: Buffer) => {
      // ── Arrow keys: ESC [ A (up) / ESC [ B (down) ──────────────────────
      if (data.length === 3 && data[0] === 0x1b && data[1] === 0x5b) {
        if (data[2] === 0x41) {
          selectedIdx = (selectedIdx - 1 + MENU_ITEMS.length) % MENU_ITEMS.length;
          redraw();
        } else if (data[2] === 0x42) {
          selectedIdx = (selectedIdx + 1) % MENU_ITEMS.length;
          redraw();
        }
        return;
      }

      // ── Enter (CR = 0x0d, LF = 0x0a) ───────────────────────────────────
      if (data[0] === 0x0d || data[0] === 0x0a) {
        cleanup();
        resolve(MENU_ITEMS[selectedIdx].value);
        return;
      }

      // ── Backspace (DEL = 0x7f on macOS, BS = 0x08 elsewhere) ───────────
      if (data[0] === 0x7f || data[0] === 0x08) {
        cleanup();
        resolve("clear");
        return;
      }

      // ── Ctrl+C ──────────────────────────────────────────────────────────
      if (data[0] === 0x03) {
        cleanup();
        process.stdout.write("\n");
        process.exit(0);
      }

      // ── Digit shortcut 0–4: jump to item, flash highlight, then confirm ─
      if (data[0] >= 0x30 && data[0] <= 0x34) {
        const value = data[0] - 0x30;
        const idx = MENU_ITEMS.findIndex((i) => i.value === value);
        if (idx !== -1) {
          selectedIdx = idx;
          redraw();
          // 120 ms flash so the user sees which item was picked.
          setTimeout(() => {
            cleanup();
            resolve(value);
          }, 120);
        }
        return;
      }
    };

    process.stdin.on("data", onData);
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.clear();

  purgeOldLogs();
  log("INFO", "=== Audiobibles CLI Session Started ===");

  const args = process.argv.slice(2);
  let defaultBookArg: number | undefined;
  const bookIndex = args.indexOf("--book");
  if (bookIndex !== -1 && args.length > bookIndex + 1) {
    const num = parseInt(args[bookIndex + 1], 10);
    if (!isNaN(num)) defaultBookArg = num;
  }

  try {
    const session = await runStep0(defaultBookArg);

    let exitRequested = false;
    let lastChoice = 1;

    while (!exitRequested) {
      const choice = await showMenu(session.defaultBook, session.version.label, lastChoice);

      if (choice === "clear") {
        clearScreen();
        continue;
      }

      if (choice !== 0) lastChoice = choice;

      try {
        switch (choice) {
          case 1: await runStep1(session); break;
          case 2: await runStep2(session); break;
          case 3: await runStep3(session); break;
          case 4: await runStep4(session); break;
          case 0: exitRequested = true; break;
        }
      } catch (error) {
        if (
          error instanceof Error &&
          (error.message.includes("cancelled") || error.message.includes("User force closed"))
        ) {
          log("WARN", `Step ${choice} cancelled by user.`);
        } else {
          const msg = error instanceof Error ? error.message : String(error);
          log("ERROR", `Step ${choice} failed: ${msg}`);
        }
      }

      if (!exitRequested) {
        divider();
        info(`Finished Step ${choice}. Returning to menu...`);
      }
    }

    divider();
    ok("Exiting CLI. Have a great day!");
    log("INFO", "=== Audiobibles CLI Session Ended ===");

  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("cancelled") || error.message.includes("User force closed")) {
        console.log("\nProcess cancelled.");
        log("WARN", "Session cancelled by user.");
      } else {
        console.error("\nAn unexpected error occurred:");
        console.error(error.message);
        log("ERROR", `Unhandled exception: ${error.stack || error.message}`);
      }
    }
    process.exit(1);
  }
}

main();
