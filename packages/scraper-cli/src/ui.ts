/**
 * Shared terminal UI for the scraper CLI.
 *
 * One live region, one renderer, used by every code path — single product,
 * store, or a mix of both. The point is that a run of any size shows the same
 * thing: what phase it is in, how far along it is, how fast, and when it will
 * finish. A 5,000-item store takes tens of minutes; without this the terminal
 * looks frozen and you cannot tell a slow run from a hung one.
 *
 * Design notes:
 *   - The live block is redrawn in place by moving the cursor up and
 *     rewriting the lines, so nothing scrolls the terminal.
 *   - When stdout is not a TTY (piped to a file, CI), the live block is
 *     suppressed and plain periodic lines are printed instead, so logs stay
 *     readable.
 *   - `NO_COLOR` is honoured: kleur strips colour when it is set.
 */

import kleur from "kleur";

/** A single row in the live block. */
export interface LiveRow {
  /** Left-hand label, e.g. "enumerating" or "scraping". */
  label: string;
  /** Right-hand value, e.g. "96/2,505". */
  value?: string;
  /** Optional dim suffix, e.g. "2.4/s · ETA 12m". */
  hint?: string;
  /** Progress bar fill, 0..1. Rendered between label and value. */
  progress?: number;
  /** Colour the value with this. Defaults to no colour. */
  valueColor?: (s: string) => string;
}

/** Options for {@link LiveDisplay}. */
export interface LiveDisplayOptions {
  /** Disable the live block entirely (plain log lines only). */
  disabled?: boolean;
}

/** Characters used for the progress bar. ASCII-safe on legacy Windows consoles. */
const BAR_FULL = "█";
const BAR_EMPTY = "░";
const BAR_WIDTH = 24;

/**
 * ANSI control sequences, built from the escape character explicitly so they
 * survive any editor that strips literal control characters from source.
 */
const ESC = String.fromCharCode(27);
/** Move the cursor up N lines. */
const CURSOR_UP = (n: number) => `${ESC}[${n}A`;
/** Erase the current line, leaving the cursor where it is. */
const ERASE_LINE = `${ESC}[2K`;
/** Hide / show the cursor. */
const HIDE_CURSOR = `${ESC}[?25l`;
const SHOW_CURSOR = `${ESC}[?25h`;

function bar(fraction: number): string {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));
  const filled = Math.round(clamped * BAR_WIDTH);
  return kleur.green(BAR_FULL.repeat(filled)) + kleur.dim(BAR_EMPTY.repeat(BAR_WIDTH - filled));
}

/** Format a duration in seconds as a compact human string. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "--";
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, "0")}m`;
}

/** Format a count with thousands separators. */
export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * A live, in-place status block.
 *
 * Call {@link update} as often as you like — it coalesces redraws to a fixed
 * interval so a fast run does not spend its time writing escape codes.
 */
export class LiveDisplay {
  private readonly enabled: boolean;
  private readonly isTty: boolean;
  private timer: NodeJS.Timeout | undefined;
  private rendered = 0;
  private lastDraw = 0;
  private pending: LiveRow[] = [];
  private lastPlain = 0;
  private readonly minIntervalMs = 100;

  constructor(options: LiveDisplayOptions = {}) {
    this.enabled = !options.disabled;
    this.isTty = Boolean(process.stdout.isTTY);
  }

  /** Start the redraw loop. */
  start(): void {
    if (!this.enabled) return;
    if (this.isTty) process.stdout.write(HIDE_CURSOR);
    this.timer = setInterval(() => this.draw(), 100);
    // Do not let the redraw loop keep the process alive on its own.
    this.timer.unref?.();
  }

  /** Queue a new set of rows and draw them if the interval has elapsed. */
  update(rows: LiveRow[]): void {
    this.pending = rows;
    this.draw();
  }

  /** Draw the block now, bypassing the coalescing interval. */
  private draw(): void {
    if (!this.enabled || !this.pending.length) return;
    const now = Date.now();
    if (now - this.lastDraw < this.minIntervalMs) return;
    this.lastDraw = now;

    if (!this.isTty) {
      // Not a terminal: print a plain line occasionally so piped logs still
      // show that the run is progressing.
      if (now - this.lastPlain < 5000) return;
      this.lastPlain = now;
      const row = this.pending[0];
      if (row) {
        const parts = [row.label];
        if (row.value) parts.push(row.value);
        if (row.hint) parts.push(row.hint);
        console.log(parts.join("  "));
      }
      return;
    }

    const lines = this.pending.map((r) => this.render(r));
    // Keep the block a constant height: if a frame has fewer rows than the
    // last one, pad with blank lines. Otherwise the leftover lines would stay
    // on screen and the cursor-up count would drift.
    const height = Math.max(lines.length, this.rendered);
    let out = "";
    if (this.rendered > 0) out += CURSOR_UP(this.rendered);
    for (let i = 0; i < height; i++) {
      out += `${ERASE_LINE}${lines[i] ?? ""}\n`;
    }
    process.stdout.write(out);
    this.rendered = height;
  }

  /** Render one row to a single terminal line. */
  private render(row: LiveRow): string {
    const left = kleur.cyan(row.label);
    const mid = row.progress !== undefined ? bar(row.progress) : "";
    const rawValue = row.value ?? "";
    const value = row.valueColor ? row.valueColor(rawValue) : rawValue;
    const hint = row.hint ? kleur.dim(row.hint) : "";
    return `  ${left}  ${mid}  ${value}  ${hint}`.trimEnd();
  }

  /** Finish: clear the live block and leave the final state on screen. */
  stop(finalRows?: LiveRow[]): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    if (!this.enabled) return;
    if (this.isTty) {
      const lines = (finalRows ?? []).map((r) => this.render(r));
      const height = Math.max(lines.length, this.rendered);
      let out = "";
      if (this.rendered > 0) out += CURSOR_UP(this.rendered);
      for (let i = 0; i < height; i++) {
        out += `${ERASE_LINE}${lines[i] ?? ""}\n`;
      }
      process.stdout.write(out);
      this.rendered = height;
    }
    if (this.isTty) process.stdout.write(SHOW_CURSOR);
    this.rendered = 0;
  }
}

/**
 * Tracks throughput so the live block can show a rate and an ETA.
 *
 * Uses a rolling window rather than a whole-run average, so the estimate
 * reflects the current pace instead of being skewed by the first slow page.
 */
export class RateTracker {
  private samples: Array<{ t: number; n: number }> = [];

  /** Record progress. */
  mark(count: number): void {
    this.samples.push({ t: Date.now(), n: count });
    // Keep a 30 second window.
    const cutoff = Date.now() - 30_000;
    while (this.samples.length > 1 && this.samples[0]!.t < cutoff) this.samples.shift();
  }

  /** Items per second over the rolling window, or 0 when unknown. */
  get rate(): number {
    if (this.samples.length < 2) return 0;
    const first = this.samples[0]!;
    const last = this.samples[this.samples.length - 1]!;
    const dt = (last.t - first.t) / 1000;
    if (dt <= 0) return 0;
    return Math.max(0, (last.n - first.n) / dt);
  }

  /** Seconds remaining at the current rate, or null when it cannot be estimated. */
  eta(remaining: number): number | null {
    const r = this.rate;
    if (r <= 0 || remaining <= 0) return null;
    return remaining / r;
  }
}
