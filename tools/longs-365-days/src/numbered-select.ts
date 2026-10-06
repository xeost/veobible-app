import chalk from "chalk";
import { createPrompt, useState, useKeypress, usePagination, isEnterKey, isUpKey, isDownKey, isNumberKey, useRef, useEffect } from "@inquirer/core";

export interface MenuChoice { name: string; value: string; disabled?: boolean | string; remember?: boolean }
interface MenuConfig { message: string; choices: MenuChoice[]; default?: string; pageSize: number }

export function nextMenuIndex(choices: readonly MenuChoice[], current: number, direction: -1 | 1): number {
  for (let step = 1; step <= choices.length; step++) {
    const next = (current + direction * step + choices.length) % choices.length;
    if (!choices[next].disabled) return next;
  }
  throw new Error("No available menu options.");
}

/** Cursor navigation wraps; pagination keeps the list in its original order. */
export const numberedSelect = createPrompt<string, MenuConfig>((config, done) => {
  const first = config.choices.findIndex(choice => !choice.disabled);
  if (first < 0) throw new Error("No available menu options.");
  const previous = config.choices.findIndex(choice => choice.value === config.default && !choice.disabled);
  const [active, setActive] = useState(previous >= 0 ? previous : first);
  const [finished, setFinished] = useState(false);
  const numberTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(numberTimer.current), []);
  useKeypress((key, readline) => {
    clearTimeout(numberTimer.current);
    if (isEnterKey(key)) {
      setFinished(true);
      done(config.choices[active].value);
    } else if (isUpKey(key) || isDownKey(key)) {
      readline.clearLine(0);
      setActive(nextMenuIndex(config.choices, active, isUpKey(key) ? -1 : 1));
    } else if (isNumberKey(key) && /^[1-9]\d*$/.test(readline.line)) {
      const index = Number(readline.line) - 1;
      if (config.choices[index] && !config.choices[index].disabled) setActive(index);
      numberTimer.current = setTimeout(() => readline.clearLine(0), 700);
    }
  });
  const list = usePagination({
    items: config.choices, active, pageSize: config.pageSize, loop: false,
    renderItem: ({ item, index, isActive }) => {
      const text = `${isActive ? "❯" : " "} ${index + 1}. ${item.name}`;
      if (item.disabled) return chalk.dim(`${text} (${typeof item.disabled === "string" ? item.disabled : "unavailable"})`);
      return isActive ? chalk.cyan(text) : text;
    }
  });
  if (finished) return `✔ ${config.message} ${chalk.cyan(config.choices[active].name)}`;
  return `? ${config.message}\n${list}\n\n${chalk.dim("Use ↑/↓ or an option number, then Enter.")}`;
});
