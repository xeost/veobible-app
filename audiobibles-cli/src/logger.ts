/**
 * Logger — one log file per day inside WORKING_DIR/logs/
 * Automatically deletes log files older than the configured retention period.
 */
import fs from "fs";
import path from "path";
import { config } from "./config.js";

const logsDir = path.join(config.workingDir, "logs");

function getTodayFilename(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}.log`;
}

function getTimestamp(): string {
  return new Date().toISOString();
}

function ensureLogsDir(): void {
  fs.mkdirSync(logsDir, { recursive: true });
}

export function log(
  level: "INFO" | "STEP" | "WARN" | "ERROR" | "DEBUG",
  message: string
): void {
  ensureLogsDir();
  const line = `[${getTimestamp()}] [${level}] ${message}\n`;
  const logFile = path.join(logsDir, getTodayFilename());
  fs.appendFileSync(logFile, line, "utf-8");
}

export function logStep(stepNum: number, description: string): void {
  log("STEP", `Step ${stepNum}: ${description}`);
}

export function purgeOldLogs(): void {
  if (!fs.existsSync(logsDir)) return;
  const retentionMs = config.logRetentionDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const files = fs.readdirSync(logsDir);
  for (const file of files) {
    const filePath = path.join(logsDir, file);
    const stat = fs.statSync(filePath);
    if (now - stat.mtimeMs > retentionMs) {
      fs.rmSync(filePath, { force: true });
      log("INFO", `Purged old log: ${file}`);
    }
  }
}
