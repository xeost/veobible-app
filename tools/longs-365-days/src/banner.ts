import boxen from "boxen";
import chalk from "chalk";

export function showBanner(): void {
  console.log(boxen(`${chalk.hex("#C4B5FD").bold("365 Days · Bible Video Production")}\n${chalk.hex("#6D28D9")("━".repeat(32))}\n${chalk.hex("#34D399")("veobible.com")}${chalk.gray("  ·  Professional Tools")}`, {
    padding: { top: 1, bottom: 1, left: 4, right: 4 }, borderStyle: "double", borderColor: "#7C3AED",
    title: chalk.hex("#A78BFA").bold(" VEOBIBLE LONGS ") + chalk.hex("#34D399").bold("CLI "), titleAlignment: "center"
  }));
}

