import fs from "fs";
import path from "path";

export function ensureDir(p: string): void {
  fs.mkdirSync(p, { recursive: true });
}

export function resolveOut(file: string): string {
  const outPath = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
  ensureDir(path.dirname(outPath));
  return outPath;
}

export function saveJSON<T>(file: string, data: T): void {
  const p = resolveOut(file);
  fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf8");
}
