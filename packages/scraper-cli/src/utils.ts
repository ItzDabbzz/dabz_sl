import fs from "fs";
import path from "path";

/**
 * Recursively create all directories in the given path (like `mkdir -p`).
 */
export function ensureDir(p: string): void {
  fs.mkdirSync(p, { recursive: true });
}

/**
 * Resolve a file path relative to `process.cwd()` if not already absolute,
 * and ensure its parent directory exists.
 *
 * @returns The resolved absolute path.
 */
export function resolveOut(file: string): string {
  const outPath = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
  ensureDir(path.dirname(outPath));
  return outPath;
}

/**
 * Serialize `data` as pretty-printed JSON and write it to `file`.
 * The parent directory is created automatically if it does not exist.
 */
export function saveJSON<T>(file: string, data: T): void {
  const p = resolveOut(file);
  fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf8");
}
