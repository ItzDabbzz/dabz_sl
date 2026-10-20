/** Second Life Marketplace item permissions. */
export interface Permissions {
  copy: string;
  modify: string;
  transfer: string;
}

/** A fully-scraped SL Marketplace product listing. */
export interface Item {
  url: string;
  title: string;
  version: string;
  images: string[];
  price: string;
  creator: { name: string; link: string };
  /** In-world avatar username of the seller (e.g. "Cult Ghoul"). */
  soldBy: string;
  store: string;
  permissions: Permissions;
  description: string;
  features: string[];
  contents: string[];
  updatedOn: string;
  /** Mesh type from the listing sidebar (e.g. "100% Mesh, Fitted Mesh"). */
  meshInfo: string;
  /** Breadcrumb path from the listing page (e.g. ["Apparel","Unisex","Unisex Footwear"]). */
  itemCategories: string[];
  /** Full URL to the associated demo listing, if present. */
  demoUrl: string;
  /** In-world SLurl (maps.secondlife.com) from "See item in Second Life". */
  inWorldUrl: string;
  /** CLI-assigned sub-category grouping; not scraped from the page. */
  categories?: Array<{ primary: string; sub: string }>;
}

/** Options controlling how a Playwright page is configured for a scrape. */
export interface PageOptions {
  /** Locator timeout in ms. Default: 4000. */
  timeout?: number;
  /** Navigation timeout in ms. Default: 10000. */
  navTimeout?: number;
  /** Block non-document/XHR/fetch resources to speed up loads. Default: true. */
  blockAssets?: boolean;
}

/** Options for the high-level `scrapeUrl` helper that manages its own browser. */
export interface ScrapeOptions extends PageOptions {
  /** Run browser in headless mode. Default: true. */
  headless?: boolean;
  /**
   * Path to Playwright storageState JSON (auth.json) used to restore a session.
   * If omitted, the scrape runs without authentication.
   */
  storageStatePath?: string;
  /** Callback invoked at the start of each scrape phase for live progress reporting. */
  onStage?: (stage: string) => void;
}

/** A product as it appears in a store's listing grid, before its detail page is visited. */
export interface StoreListingItem {
  /** Canonical marketplace product id (the `id="product-<id>"` on the grid card). */
  productId: string;
  /** Canonical product URL, `/p/<slug>/<productId>`. */
  url: string;
  /** Listing title as shown in the grid. */
  title: string;
  /** Price in Linden dollars, as text (e.g. `"L$ 369"`). */
  price: string;
  /** Creator / brand name as shown in the grid. */
  brand: string;
  /** Breadcrumb category path from the grid card, when present. */
  category: string[];
  /** First image URL from the grid card. */
  image: string;
}

/** A failed detail scrape during a store run. */
export interface StoreScrapeFailure {
  url: string;
  error: string;
  /** HTTP status of the failed response, when the failure was an HTTP one. */
  status?: number;
}

/** Result of a full store scrape. */
export interface StoreScrapeResult {
  /** Store id that was scraped. */
  storeId: string;
  /** Total items the store reported, as parsed from "N matching items found". */
  totalItems: number;
  /** Number of listing pages that were fetched during enumeration. */
  pagesFetched: number;
  /** Fully scraped items, in enumeration order. */
  items: Item[];
  /** Items that failed to scrape. */
  failures: StoreScrapeFailure[];
  /** Listing-only rows, present when the scrape ran in listing-only mode. */
  listing: StoreListingItem[];
  /** Set when the run was aborted because the origin started refusing requests. */
  aborted?: string;
}

/** Options for store scraping. */
export interface StoreScrapeOptions extends ScrapeOptions {
  /**
   * Number of product pages fetched in parallel. Kept low on purpose — the
   * global {@link StoreScrapeOptions.minDelayMs} is the real throttle.
   * Default 2.
   */
  concurrency?: number;
  /**
   * Minimum delay in milliseconds between any two requests to the marketplace,
   * enforced globally across all workers. Default 1000ms.
   */
  minDelayMs?: number;
  /**
   * When true, stop after enumeration and return the listing rows without
   * visiting any product pages. Cheap (one request per 96 items) and useful
   * for previewing or exporting a catalog.
   */
  listingOnly?: boolean;
  /**
   * Maximum number of listing pages to fetch during enumeration. Defaults to
   * all of them.
   */
  maxPages?: number;
  /**
   * Extra query parameters to preserve on the store URL (e.g. `search[sort]`).
   */
  query?: Record<string, string>;
  /** Called after each item is scraped. */
  onItem?: (item: Item, index: number, total: number) => void;
  /** Called when enumeration completes, with the discovered listing. */
  onEnumerated?: (listing: StoreListingItem[], totalItems: number) => void;
  /**
   * Called after each listing page is fetched, so a caller can show
   * enumeration progress. `totalItems` is 0 until the first page reports it.
   */
  onPage?: (page: number, found: number, totalItems: number) => void;
  /**
   * Called when the run is aborted because the marketplace started refusing
   * requests. Checkpoint state is preserved so the run can be resumed later.
   */
  onAborted?: (reason: string) => void;
  /**
   * Path to the run's checkpoint file.
   *
   * This is the single source of truth for a run's persistence: it holds the
   * enumerated listing, the completed table, the failures and the item that
   * was in flight when the run stopped. It is append-only, so it is written
   * after every item at O(1) cost, and a crash loses at most the item that
   * was in flight.
   *
   * On resume, the listing is read back from it, so the store is not
   * re-enumerated.
   */
  checkpointPath?: string;
  /**
   * Path the enumerated listing is written to, immediately after enumeration
   * completes and before any product page is visited.
   *
   * This is a convenience export of the listing as plain JSON. The checkpoint
   * already holds the listing, so this file is optional.
   */
  listingPath?: string;
  /**
   * Reuse the listing persisted in the checkpoint instead of re-enumerating
   * the store.
   *
   * Saves one listing request per 96 items on a resumed run, and guarantees
   * the same item set as the original run. The listing can be stale if the
   * store has changed since.
   */
  reuseListing?: boolean;
}
