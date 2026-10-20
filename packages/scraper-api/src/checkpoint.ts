/**
 * The run checkpoint: one append-only JSONL file holding all of a run's
 * persistence state.
 *
 * Design rules this file follows, and why:
 *
 *  1. **One source of truth.** The completed set, the uncompleted set and the
 *     in-flight item are all derived from this file. Deriving them instead
 *     of storing them separately means they cannot drift apart — and two
 *     files disagreeing about what has been done is how a resume silently
 *     skips an item that was never actually written.
 *
 *  2. **Append-only.** Every write is an O(1) append of one line, so the
 *     checkpoint can be updated after *every* item rather than in batches. A
 *     rewrite of a growing set is O(n) per write and O(n²) across a run, and
 *     the batch size then has to grow to compensate — which is exactly how you
 *     end up losing work on a crash.
 *
 *  3. **Crash-safe by construction.** The only possible corruption is a
 *     partially written final line, and that is detected on read (invalid
 *     JSON) and discarded. A truncated file is never trusted as complete.
 *
 *  4. **The listing is persisted when it is known.** The enumerated listing
 *     is written as soon as enumeration finishes, before any product page is
 *     visited, so an interrupted run resumes without re-requesting every
 *     listing page.
 *
 * File format — one JSON object per line:
 *
 *     {"t":"listing","items":[...],"total":1234}   the enumerated listing
 *     {"t":"done","id":"12345","item":{...}}        an item finished
 *     {"t":"fail","id":"12345","error":"..."}        an item failed
 *     {"t":"current","id":"12345"}                  work started on an item
 *     {"t":"current-clear"}                        work finished on that item
 *
 * The uncompleted table is not stored as its own record: it is the listing
 * minus the completed set, which is always exactly correct and can never
 * disagree with the rest of the file. {@link pendingFrom} derives it, and
 * {@link describeCheckpoint} renders both tables for a status report.
 */

import fs from "fs";
import path from "path";
import type { Item, StoreListingItem } from "./types.js";

/** A checkpoint record. */
export type CheckpointRecord =
  | { t: "listing"; items: StoreListingItem[]; total: number }
  | { t: "done"; id: string; item: Item }
  | { t: "fail"; id: string; error: string }
  | { t: "current"; id: string }
  | { t: "current-clear"; id: string };

/** The state a checkpoint file holds. */
export interface CheckpointState {
  /** The enumerated listing, if it was persisted. */
  listing: StoreListingItem[];
  /** Total item count the store reported. */
  total: number;
  /** Ids of items that finished successfully. */
  done: Set<string>;
  /** Ids of items that failed, with the reason. */
  failed: Map<string, string>;
  /**
   * The item currently being worked on, if any.
   *
   * With concurrent workers there can be more than one item in flight, so
   * {@link CheckpointState.inFlight} holds the full set and this holds the
   * most recent one.
   */
  current: string | null;
  /** Every item currently in flight. */
  inFlight: Set<string>;
  /** Completed items, keyed by id, in completion order. */
  items: Map<string, Item>;
}

/** An empty checkpoint state. */
export function emptyCheckpoint(): CheckpointState {
  return {
    listing: [],
    total: 0,
    done: new Set(),
    failed: new Map(),
    current: null,
    inFlight: new Set(),
    items: new Map(),
  };
}

/**
 * Read a checkpoint file.
 *
 * A truncated final line (a crash mid-append) is skipped rather than
 * throwing: the record it held is treated as never written, which is the safe
 * direction — that item simply gets redone.
 */
export function readCheckpointFile(file: string): CheckpointState {
  const state = emptyCheckpoint();
  if (!fs.existsSync(file)) return state;

  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    return state;
  }

  const trimmed = raw.trim();
  if (!trimmed) return state;

  // Tolerate the older checkpoint format, which was a single JSON object
  // holding an array of done ids. Detected by parsing the whole file as one
  // JSON document — a JSONL file never parses that way, because it has more
  // than one JSON value in it.
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as { done?: string[] };
      if (Array.isArray(parsed.done)) {
        for (const id of parsed.done) state.done.add(id);
        return state;
      }
    } catch {
      /* not a single JSON document: fall through to the JSONL reader */
    }
  }

  for (const line of raw.split("\n")) {
    const text = line.trim();
    if (!text) continue;

    let record: CheckpointRecord;
    try {
      record = JSON.parse(text) as CheckpointRecord;
    } catch {
      // Torn final line from a crash mid-append. Skip it.
      continue;
    }
    if (!record || typeof record !== "object" || !("t" in record)) continue;

    switch (record.t) {
      case "listing":
        state.listing = Array.isArray(record.items) ? record.items : [];
        state.total = typeof record.total === "number" ? record.total : state.listing.length;
        break;
      case "done":
        state.done.add(record.id);
        if (record.item) state.items.set(record.id, record.item);
        break;
      case "fail":
        state.failed.set(record.id, record.error);
        break;
      case "current":
        state.current = record.id;
        state.inFlight.add(record.id);
        break;
      case "current-clear":
        // Clearing is per-id: with concurrent workers, one worker finishing
        // must not clear another worker's in-flight marker.
        state.inFlight.delete(record.id);
        if (state.current === record.id) {
          // The cleared item was the most recent; fall back to another
          // in-flight item, if there is one.
          const remaining = Array.from(state.inFlight);
          state.current = remaining.length ? remaining[remaining.length - 1]! : null;
        }
        break;
    }
  }

  return state;
}

/**
 * An append-only checkpoint writer.
 *
 * Every mutation is a single append of one line. There is no rewrite, so the
 * file is always a valid prefix of the run's history.
 */
export class CheckpointWriter {
  private readonly file: string;
  private buffer: string[] = [];

  constructor(file: string) {
    this.file = file;
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  }

  /** Append one record and flush it to disk. */
  write(record: CheckpointRecord): void {
    this.buffer.push(JSON.stringify(record) + "\n");
    this.flush();
  }

  /**
   * Flush buffered records to disk.
   *
   * A single write call for the whole buffer, so a burst of records costs one
   * syscall rather than one per record.
   */
  flush(): void {
    if (!this.buffer.length) return;
    const payload = this.buffer.join("");
    this.buffer.length = 0;
    try {
      fs.appendFileSync(this.file, payload, "utf8");
    } catch {
      /* checkpointing is best-effort */
    }
  }

  /** Record the enumerated listing. Written once, before any product page. */
  writeListing(listing: StoreListingItem[], total: number): void {
    this.write({ t: "listing", items: listing, total });
  }

  /** Record that an item finished successfully. */
  writeDone(id: string, item: Item): void {
    this.write({ t: "done", id, item });
  }

  /** Record that an item failed. */
  writeFail(id: string, error: string): void {
    this.write({ t: "fail", id, error });
  }

  /** Record that work started on an item. */
  writeCurrent(id: string): void {
    this.write({ t: "current", id });
  }

  /** Record that work on an item finished. */
  writeCurrentClear(id: string): void {
    this.write({ t: "current-clear", id });
  }

  /** Remove the checkpoint file, for a fresh run. */
  static remove(file: string): void {
    try {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } catch {
      /* best effort */
    }
  }
}

/**
 * Derive the uncompleted work from a checkpoint.
 *
 * The uncompleted table is never stored — it is the listing minus the items
 * that are done. Deriving it means the two can never disagree, which is the
 * whole point of keeping one source of truth.
 */
export function pendingFrom(state: CheckpointState): StoreListingItem[] {
  if (!state.listing.length) return [];
  return state.listing.filter((row) => !state.done.has(row.productId));
}

/** A human-readable summary of a checkpoint's state. */
export interface CheckpointSummary {
  /** Total products in the listing. */
  total: number;
  /** How many have completed. */
  completed: number;
  /** How many are still outstanding. */
  remaining: number;
  /** How many failed. */
  failed: number;
  /** The item that was in flight when the run stopped, if any. */
  current: string | null;
  /** Every item that was in flight when the run stopped. */
  inFlight: string[];
  /** The completed table, in completion order. */
  completedItems: Item[];
  /** The uncompleted table. */
  remainingItems: StoreListingItem[];
  /** Failures, with their reasons. */
  failures: Array<{ id: string; error: string }>;
}

/** Render a checkpoint's state as a summary, including both tables. */
export function describeCheckpoint(state: CheckpointState): CheckpointSummary {
  const remaining = pendingFrom(state);
  return {
    total: state.total || state.listing.length,
    completed: state.done.size,
    remaining: remaining.length,
    failed: state.failed.size,
    current: state.current,
    inFlight: Array.from(state.inFlight),
    completedItems: Array.from(state.items.values()),
    remainingItems: remaining,
    failures: Array.from(state.failed.entries()).map(([id, error]) => ({ id, error })),
  };
}
