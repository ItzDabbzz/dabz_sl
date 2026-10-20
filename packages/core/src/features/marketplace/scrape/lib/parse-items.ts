/**
 * Parsing for marketplace item files.
 *
 * The scraper CLI writes `.items.jsonl` — one item per line — because that is
 * what survives an interrupted run. The same data also shows up as a plain
 * JSON array, and the checkpoint file is JSONL too (with its own record types
 * mixed in). This module reads all of them so the importer does not have to
 * care which file the user grabbed.
 *
 * The `ScrapedItem` shape below mirrors the scraper CLI's output. It is kept
 * local rather than imported because the web app does not depend on the
 * scraper package — the file format is the contract between them.
 */

import type { ScrapedItem } from "./types";

/** The result of parsing a file. */
export interface ParsedItems {
    /** The items found in the file. */
    items: ScrapedItem[];
    /** What the file turned out to be, for a useful message. */
    kind: "json" | "jsonl" | "checkpoint" | "empty";
}

/**
 * Parse a marketplace item file.
 *
 * Accepts, in order of preference:
 *   - a JSON array of items
 *   - a JSON object with an `items` array
 *   - JSONL: one item per line
 *   - a checkpoint file: JSONL where `done` records carry the item
 *
 * @param text - the raw file contents
 * @returns the items found, and which format they came from
 */
export function parseItemsFile(text: string): ParsedItems {
    const trimmed = text.trim();
    if (!trimmed) return { items: [], kind: "empty" };

    // A whole-file JSON document: an array, or an object with an `items` array.
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
        try {
            const parsed = JSON.parse(trimmed) as
                | ScrapedItem[]
                | { items?: ScrapedItem[] };
            if (Array.isArray(parsed)) return { items: parsed, kind: "json" };
            if (Array.isArray(parsed.items)) {
                return { items: parsed.items, kind: "json" };
            }
        } catch {
            // Not a single JSON document after all — fall through to the
            // line-by-line reader, which is what a JSONL file needs.
        }
    }

    // JSONL: one record per line.
    const items: ScrapedItem[] = [];
    let sawCheckpointRecord = false;
    let badLines = 0;

    for (const line of trimmed.split("\n")) {
        const text = line.trim();
        if (!text) continue;

        let record: unknown;
        try {
            record = JSON.parse(text);
        } catch {
            badLines++;
            continue;
        }
        if (!record || typeof record !== "object") {
            badLines++;
            continue;
        }

        const obj = record as Record<string, unknown>;

        // Checkpoint record: the item is nested under `item`.
        if (obj.t === "done" && obj.item && typeof obj.item === "object") {
            sawCheckpointRecord = true;
            items.push(obj.item as ScrapedItem);
            continue;
        }
        // Any other checkpoint record (listing index rows, failures, in-flight
        // markers) is not a full item, so it is skipped. A listing row has no
        // description or permissions — importing it would create empty records.
        if (obj.t) {
            sawCheckpointRecord = true;
            continue;
        }

        // A bare item.
        if (typeof obj.url === "string" || typeof obj.title === "string") {
            items.push(record as ScrapedItem);
            continue;
        }

        badLines++;
    }

    if (items.length) {
        return { items, kind: sawCheckpointRecord ? "checkpoint" : "jsonl" };
    }

    if (sawCheckpointRecord) return { items: [], kind: "checkpoint" };
    if (badLines) {
        throw new Error(
            `Could not read any items. ${badLines} line${badLines === 1 ? "" : "s"} could not be parsed.`,
        );
    }
    return { items: [], kind: "empty" };
}

/** A short description of a parsed file, for the status message. */
export function describeParsed(parsed: ParsedItems): string {
    const count = parsed.items.length;
    const label =
        parsed.kind === "json"
            ? "JSON file"
            : parsed.kind === "jsonl"
              ? "JSONL file"
              : parsed.kind === "checkpoint"
                ? "checkpoint file"
                : "file";
    return `Loaded ${count} item${count === 1 ? "" : "s"} from ${label}`;
}
