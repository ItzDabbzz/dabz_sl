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
