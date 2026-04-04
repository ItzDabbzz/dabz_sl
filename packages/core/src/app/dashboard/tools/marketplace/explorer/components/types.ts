/** Shared types used by Explorer components */
export type Item = {
    id: string;
    url: string;
    title: string;
    version?: string | null;
    price?: string;
    creator?: { name: string; link: string } | null;
    store?: string | null;
    images?: string[] | null;
    description?: string | null;
    permissions?: { copy?: string; modify?: string; transfer?: string } | null;
    features?: string[] | null;
    contents?: string[] | null;
    isNsfw?: boolean | null;
    updatedOn?: string | null;
    ratingAvg?: number | string | null;
    ratingCount?: number | null;
};

export type Category = { id: string; primary: string; sub: string };
export type Page = { limit: number; offset: number; total: number };
