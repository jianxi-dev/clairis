/**
 * Unified logger for Clairis.
 * In Tauri: logs to Rust tracing backend (via invoke or console).
 * In browser: logs to console with timestamp and level prefix.
 *
 * Usage:
 *   import { log } from "../utils/log";
 *   log.info("FileTree", "Loading folder", { path });
 *   log.warn("Decoration", "Large file detected", { size });
 *   log.error("SaveFile", "Write failed", e);
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LEVEL: LogLevel = "info"; // Change to "debug" for verbose output

interface LogEntry {
  ts: string;
  module: string;
  level: LogLevel;
  message: string;
  data?: unknown;
}

const MAX_BUFFER = 200;
const buffer: LogEntry[] = [];

function shouldLog(level: LogLevel): boolean {
  return LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[MIN_LEVEL];
}

function format(entry: LogEntry): string {
  const base = `[${entry.ts}] [${entry.level.toUpperCase()}] [${entry.module}] ${entry.message}`;
  if (entry.data !== undefined) {
    const extra =
      entry.data instanceof Error
        ? `${entry.data.message}\n${entry.data.stack}`
        : JSON.stringify(entry.data, null, 0);
    return `${base} — ${extra}`;
  }
  return base;
}

function emit(
  level: LogLevel,
  module: string,
  message: string,
  data?: unknown,
) {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    ts: new Date().toISOString(),
    module,
    level,
    message,
    data,
  };

  // Ring buffer
  buffer.push(entry);
  if (buffer.length > MAX_BUFFER) buffer.shift();

  const line = format(entry);
  switch (level) {
    case "error":
      console.error(line);
      break;
    case "warn":
      console.warn(line);
      break;
    case "info":
      console.info(line);
      break;
    case "debug":
      console.debug(line);
      break;
  }
}

export const log = {
  debug: (module: string, message: string, data?: unknown) =>
    emit("debug", module, message, data),
  info: (module: string, message: string, data?: unknown) =>
    emit("info", module, message, data),
  warn: (module: string, message: string, data?: unknown) =>
    emit("warn", module, message, data),
  error: (module: string, message: string, data?: unknown) =>
    emit("error", module, message, data),
  /** Get recent log entries for debugging */
  recent: (count = 50) => buffer.slice(-count),
  /** Clear buffer */
  clear: () => (buffer.length = 0),
};

// Expose for console debugging
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__clairis_log__ = log;
}
