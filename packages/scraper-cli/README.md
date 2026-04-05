# `@dabzsl/scraper-cli`

Local CLI tool for bulk-scraping Second Life Marketplace product pages and exporting results to JSON and/or XLSX.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Authentication](#authentication)
- [Basic Usage](#basic-usage)
- [CLI Flags Reference](#cli-flags-reference)
- [Input Sources](#input-sources)
- [Output Options](#output-options)
- [Category Grouping (Catalog mode)](#category-grouping-catalog-mode)
- [Scraped Data Fields](#scraped-data-fields)
- [Performance Tuning](#performance-tuning)
- [Scripts Reference](#scripts-reference)

---

## Prerequisites

- Node.js 22+
- pnpm 9.12+ (run `pnpm install` from the repo root)
- Playwright Chromium — installed automatically by `pnpm install`

---

## Getting Started

```bash
# From the repo root
pnpm install

# From packages/scraper-cli (local dev)
cd packages/scraper-cli
pnpm install
```

---

## Authentication

The SL Marketplace requires a login session to access certain listing details. The CLI reads a saved Playwright storage state from `out/auth.json`.

### Save a session

```bash
pnpm --filter @dabzsl/scraper-cli login
# or from packages/scraper-cli:
pnpm login
```

This opens a visible Chromium window pointed at `https://marketplace.secondlife.com/account`. Log in manually, then press **Enter** in the terminal. The session is saved to `out/auth.json`.

> If `out/auth.json` does not exist and the target URLs are not `file://` paths, the scraper will exit with an error.

---

## Basic Usage

### Scrape a single URL

```bash
pnpm --filter @dabzsl/scraper-cli scrape -- \
  --url "https://marketplace.secondlife.com/p/item-name/12345"
```

### Scrape from a text file (one URL per line)

```bash
pnpm --filter @dabzsl/scraper-cli scrape -- \
  --input urls.txt
```

### Scrape multiple files and export to XLSX

```bash
pnpm --filter @dabzsl/scraper-cli scrape -- \
  --input heads.txt \
  --input bodies.txt \
  --xlsx \
  --name my-collection
```

### Test against a local HTML file (no auth needed)

```bash
pnpm --filter @dabzsl/scraper-cli scrape -- \
  --file ./test-page.html
```

---

## CLI Flags Reference

### Input

| Flag | Alias | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--url` | `-u` | `string[]` | — | One or more product URLs. Repeat to add multiple. |
| `--input` | `-i` | `string[]` | — | Text file(s) with URLs (one per line). Repeat to add multiple files. |
| `--file` | | `string` | — | Local HTML file path to scrape (converted to `file://` URL internally) |

### Output

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--json` | `string` | — | Explicit JSON output path (overrides auto-naming) |
| `--json-dir` | `string` | `out` | Directory for auto-named JSON output |
| `--xlsx` | `boolean` | `false` | Also write an XLSX file |
| `--xlsx-out` | `string` | — | Explicit XLSX output path |
| `--xlsx-dir` | `string` | — | Directory for auto-named XLSX output |
| `--name` | `string` | — | Base filename (without extension) for auto-named outputs |

### Browser

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--headless` | `boolean` | `true` | Run Chromium in headless mode. Set `--no-headless` to watch the browser. |
| `--block-assets` | `boolean` | `true` | Block images, fonts, CSS, and media to speed up page loads |
| `--timeout` | `number` | `4000` | Default Playwright locator timeout (ms) |
| `--nav-timeout` | `number` | `10000` | Default navigation timeout (ms) |

### Concurrency

| Flag | Alias | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--concurrency` | `-c` | `number` | `3` | Number of pages to scrape in parallel |

### Display

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--pretty` | `boolean` | `true` | Color output and progress bars. Disable for plain/log output. |
| `--verbose` | `boolean` | `false` | More detailed logs per URL |
| `--preview` | `number` | `10` | Show a table preview of the first N results after scraping |

### Category Grouping

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--primary` | `string` | `"Catalog"` | Primary category name when using `--sub` |
| `--sub` | `string[]` | — | Subcategory spec. Format: `"Name=path/to/urls.txt"`. Repeat for multiple. |
| `--write-catalog` | `boolean` | Auto | Also write a grouped catalog JSON. Auto-enabled when `--sub` is used. |

### Deprecated

| Flag | Description |
|------|-------------|
| `--out` | Old XLSX output path. Use `--xlsx` or `--xlsx-out` instead. |

---

## Input Sources

All input sources are de-duplicated before scraping. You can combine them freely:

```bash
# Mix URL flags, input files, and sub-category files
pnpm --filter @dabzsl/scraper-cli scrape -- \
  --url "https://marketplace.secondlife.com/p/special-item/99999" \
  --input common-items.txt \
  --primary "Collection" \
  --sub "Heads=heads.txt" \
  --sub "Bodies=bodies.txt"
```

Input text files should contain one URL per line. Blank lines and whitespace are stripped automatically.

---

## Output Options

### JSON

A JSON array of `Item` objects is always written. If `--json` is not given, the file is auto-named and placed in `--json-dir` (default: `out/`).

**Auto-naming priority:**
1. `--name` flag value (slugified)
2. URL slug of a single input URL
3. Timestamp fallback (`items-YYYYMMDD-HHMMSS`)

### XLSX

When `--xlsx` is set, a spreadsheet is written alongside the JSON. Each row represents one item with the following columns:

| Column | Description |
|--------|-------------|
| Title | Product title |
| Version | Version string |
| Images | Image URLs (newline-separated) |
| Linden Price | Price (e.g. `L$250`) |
| Creator Name | Creator display name |
| Creator Link | Creator profile URL |
| Sold By | In-world avatar username |
| Store Link | Store URL |
| Copy / Modify / Transfer | Permission strings |
| Mesh | Mesh type string |
| Categories | Breadcrumb (e.g. `Apparel > Unisex`) |
| Description | Full listing description |
| Features | Bullet points (newline-separated) |
| Contents | Package contents (newline-separated) |
| Item Updated On | Last updated date |
| Demo URL | Demo listing URL |
| In-World URL | SLurl (`maps.secondlife.com`) |
| URL | Source product URL |

### Catalog JSON

When `--sub` is used (or `--write-catalog` is set), an additional `*-catalog.json` is written. It is a nested object grouped by primary and sub category:

```json
{
  "Collection": {
    "Heads": [ { /* Item */ }, … ],
    "Bodies": [ { /* Item */ }, … ]
  }
}
```

---

## Category Grouping (Catalog mode)

The `--primary` / `--sub` system lets you scrape items from multiple URL lists and automatically tag them for catalog export.

```bash
pnpm --filter @dabzsl/scraper-cli scrape -- \
  --primary "Project Arousal 2" \
  --sub "Heads=devshi/urls_heads.txt" \
  --sub "Bodies=devshi/urls_heads.txt" \
  --sub "Genitals=devshi/urls_genitals.txt" \
  --sub "Mesh Addons=devshi/urls_mesh_addons.txt" \
  --xlsx
```

This produces:
- `out/<name>.json` — flat item array
- `out/<name>-catalog.json` — grouped by primary / sub
- `out/<name>.xlsx` — flat spreadsheet

---

## Scraped Data Fields

See the [`@dabzsl/scraper-api` README](../scraper-api/README.md#types) for the full `Item` type definition that describes every field extracted from a listing page.

The scrape proceeds through the following internal phases (visible in `--verbose` output):

| Stage | Description |
|-------|-------------|
| `navigating` | Navigate to the product URL |
| `title` | Extract title and version |
| `images` | Extract image URLs |
| `price` | Extract Linden price |
| `creator` | Extract creator name and profile link |
| `permissions` | Extract copy/modify/transfer |
| `description` | Extract full description |
| `features` | Extract feature bullets |
| `updated` | Extract last-updated date |
| `meta` | Extract mesh info, categories, demo URL, SLurl |
| `done` | Scrape complete |

---

## Performance Tuning

| Goal | Recommendation |
|------|---------------|
| Maximum speed | `--concurrency 5` + `--block-assets` (default on) |
| Debug hangs | `--no-headless --timeout 15000 --nav-timeout 30000` |
| CI / plain logs | `--no-pretty --no-verbose` |
| Slow network | Increase `--nav-timeout 30000` |

The default concurrency of 3 is a safe balance between speed and avoiding rate limits on the SL Marketplace.

---

## Scripts Reference

Run from `packages/scraper-cli/` or prefix with `pnpm --filter @dabzsl/scraper-cli` from the repo root.

| Script | Description |
|--------|-------------|
| `dev` | Run with `tsx` (no build step) |
| `scrape` | Alias for `dev` — run the scraper |
| `login` | Open a browser to save a session to `out/auth.json` |
| `build` | Compile TypeScript to `dist/` |
| `typecheck` | `tsc --noEmit` |
| `start` | Run compiled `dist/index.js` |
