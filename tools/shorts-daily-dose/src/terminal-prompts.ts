import { numberedSelect, type MenuChoice } from "./numbered-select.js";
import { showBanner } from "./banner.js";

export function startAtTopPreservingHistory(): void {
  if (!process.stdout.isTTY) return;
  const rows = process.stdout.rows || 24;
  // Scroll the current viewport into the terminal history, then move to its
  // first row. Clearing the screen here would discard visible prior output.
  process.stdout.write(`\x1b[${rows};1H${"\n".repeat(rows)}\x1b[H`);
}

export async function promptAtTopOnBackspace<T>(run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  while (true) {
    const controller = new AbortController();
    let refresh = false;
    const onKeypress = (_character: string, key: { name?: string } | undefined) => {
      if (key?.name === "backspace") {
        refresh = true;
        controller.abort();
      }
    };
    process.stdin.on("keypress", onKeypress);
    try {
      return await run(controller.signal);
    } catch (error) {
      if (!refresh) throw error;
    } finally {
      process.stdin.off("keypress", onKeypress);
    }
    startAtTopPreservingHistory();
  }
}
interface NumberedMenu {
  message: string;
  choices: MenuChoice[];
  default?: string;
}

async function showNumberedMenu(menu: NumberedMenu): Promise<string> {
  return promptAtTopOnBackspace(signal => {
    startAtTopPreservingHistory();
    showBanner();
    // Keep fixed ordering and reserve screen space for the banner and heading.
    const columns = Math.max(20, process.stdout.columns || 80);
    const pageSize = menu.choices.reduce((total, choice) => total + choice.name.split("\n")
      .reduce((rows, line) => rows + Math.max(1, Math.ceil((line.length + 30) / columns)), 0), 0);
    const headingRows = menu.message.split("\n").reduce((rows, line) => rows + Math.max(1, Math.ceil((line.length + 2) / columns)), 0);
    const availableRows = Math.max(3, (process.stdout.rows || 24) - 7 - headingRows - 3);
    return numberedSelect({
      ...menu,
      pageSize: Math.max(1, Math.min(pageSize, availableRows)),
    }, { signal });
  });
}

/** Keep selections by stable menu identity, even when labels or ordering change. */
export function createNumberedMenu(run: (menu: NumberedMenu) => Promise<string> = showNumberedMenu) {
  const selections = new Map<string, string>();
  const choose = async (key: string, menu: NumberedMenu) => {
    const previous = selections.get(key);
    const available = menu.choices.some(choice => choice.value === previous && !choice.disabled);
    const selected = await run({ ...menu, default: available ? previous : menu.default });
    if (menu.choices.find(choice => choice.value === selected)?.remember === false) selections.delete(key);
    else selections.set(key, selected);
    return selected;
  };
  return Object.assign(choose, { forget: (key: string) => { selections.delete(key); } });
}

export const numberedMenu = createNumberedMenu();
