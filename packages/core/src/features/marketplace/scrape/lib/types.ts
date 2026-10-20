/**
 * The shape of a marketplace item as written to a file by the scraper CLI.
 *
 * The web app does not depend on the scraper package, so the file format is
 * the contract between them and the type lives here.
 */
export interface ScrapedItem {
    url: string;
    title: string;
    version?: string;
    images?: string[];
    price?: string;
    creator?: { name: string; link: string };
    /** In-world avatar username of the seller. */
    soldBy?: string;
    store?: string;
    permissions?: { copy: string; modify: string; transfer: string };
    description?: string;
    features?: string[];
    contents?: string[];
    updatedOn?: string;
    /** Mesh type from the listing sidebar. */
    meshInfo?: string;
    /**
     * The marketplace's own category path, e.g.
     * ["Apparel", "Women's", "Women's Footwear", "Women's Boots"].
     */
    itemCategories?: string[];
    /** Full URL to the associated demo listing, if present. */
    demoUrl?: string;
    /** In-world SLurl from "See item in Second Life". */
    inWorldUrl?: string;
}
