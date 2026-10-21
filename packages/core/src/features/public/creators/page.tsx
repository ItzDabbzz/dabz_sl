import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    BadgeCheck,
    MapPin,
    Package,
    Rss,
    Search,
    Users,
} from "lucide-react";
import {
    listPublishedCreators,
    type DirectoryCreator,
    type DirectorySort,
} from "./server/directory";

export const metadata = {
    title: "Creators",
    description:
        "Every creator with a public page: their products, their posts and the Second Life accounts they have proven they own.",
};

/** The initials a creator's name starts with. */
function initials(displayName: string) {
    return displayName.trim().slice(0, 2).toUpperCase();
}

/** One creator in the directory. */
function CreatorCard({ creator }: { creator: DirectoryCreator }) {
    // A creator's own avatar is used when they have one; otherwise the
    // picture of the person or team behind the page stands in.
    const avatar = creator.avatarUrl || creator.ownerImage;

    return (
        <Card className="flex flex-col overflow-hidden">
            {creator.bannerUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={creator.bannerUrl}
                    alt=""
                    className="h-20 w-full object-cover"
                />
            ) : (
                <div className="h-20 w-full bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
            )}
            <CardContent className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12 shrink-0 border-2">
                        {avatar ? (
                            <AvatarImage src={avatar} alt="" />
                        ) : null}
                        <AvatarFallback>
                            {initials(creator.displayName)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 space-y-1">
                        <h2 className="truncate text-base font-medium">
                            <Link
                                href={`/c/${creator.slug}`}
                                className="hover:underline"
                            >
                                {creator.displayName}
                            </Link>
                        </h2>
                        {creator.tagline ? (
                            <p className="line-clamp-2 text-sm text-muted-foreground">
                                {creator.tagline}
                            </p>
                        ) : creator.bio ? (
                            <p className="line-clamp-2 text-sm text-muted-foreground">
                                {creator.bio}
                            </p>
                        ) : null}
                        {creator.ownerName &&
                        creator.ownerName !== creator.displayName ? (
                            <p className="truncate text-xs text-muted-foreground">
                                {creator.ownerName}
                            </p>
                        ) : null}
                    </div>
                    <Badge variant="outline" className="shrink-0">
                        {creator.ownerType === "organization" ? (
                            <Users className="h-3 w-3" />
                        ) : null}
                        {creator.ownerType === "organization"
                            ? "Team"
                            : "Creator"}
                    </Badge>
                </div>

                {creator.accountNames.length ? (
                    <div className="flex flex-wrap gap-1">
                        {creator.accountNames.map((name) => (
                            <Badge
                                key={name}
                                variant="outline"
                                className="gap-1"
                            >
                                <BadgeCheck className="h-3 w-3 text-primary" />
                                {name}
                            </Badge>
                        ))}
                    </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                        <Package className="h-3.5 w-3.5" />
                        {creator.productCount}{" "}
                        {creator.productCount === 1 ? "product" : "products"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                        <Rss className="h-3.5 w-3.5" />
                        {creator.postCount}{" "}
                        {creator.postCount === 1 ? "post" : "posts"}
                    </span>
                </div>

                {creator.locations ? (
                    <div className="flex items-start gap-1 text-xs text-muted-foreground">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span className="whitespace-pre-line">
                            {creator.locations}
                        </span>
                    </div>
                ) : null}

                <div className="mt-auto pt-1">
                    <Button asChild variant="ghost" size="sm">
                        <Link href={`/c/${creator.slug}`}>
                            View their page
                        </Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

/**
 * The public directory of creators.
 *
 * Everyone who has published a page is here, so a visitor can find the
 * creator they are looking for and go to their page.
 */
export default async function CreatorsDirectoryPage({
    searchParams,
}: {
    searchParams: Promise<{
        q?: string;
        sort?: string;
        p?: string;
    }>;
}) {
    const params = await searchParams;
    const q = (params.q ?? "").trim();
    const sort: DirectorySort =
        params.sort === "newest" || params.sort === "products"
            ? params.sort
            : "name";
    const page = Math.max(1, Number(params.p || 1) || 1);

    const directory = await listPublishedCreators({ q, sort, page });

    /** The address of this page, with the given search and sort. */
    const makeHref = (target: number) => {
        const sp = new URLSearchParams();
        if (q) sp.set("q", q);
        if (sort !== "name") sp.set("sort", sort);
        if (target > 1) sp.set("p", String(target));
        const query = sp.toString();
        return query ? `/creators?${query}` : "/creators";
    };

    return (
        <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
            {/* Header */}
            <header className="space-y-4">
                <div className="space-y-1">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Creators
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {directory.total}{" "}
                        {directory.total === 1 ? "creator" : "creators"}
                        {q ? ` matching "${q}"` : ""}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Search */}
                    <form action="/creators" className="flex items-center gap-2">
                        <input
                            type="text"
                            name="q"
                            defaultValue={q}
                            placeholder="Search creators..."
                            className="h-9 w-56 rounded border bg-background px-3 text-sm"
                        />
                        {sort !== "name" ? (
                            <input type="hidden" name="sort" value={sort} />
                        ) : null}
                        <button className="inline-flex h-9 items-center gap-1 rounded bg-primary px-3 text-sm text-primary-foreground">
                            <Search className="h-3.5 w-3.5" />
                            Search
                        </button>
                    </form>
                    {/* Sort */}
                    <form action="/creators" className="flex items-center gap-2">
                        <select
                            name="sort"
                            defaultValue={sort}
                            className="h-9 rounded border bg-background px-2 text-sm"
                        >
                            <option value="name">Name (A-Z)</option>
                            <option value="newest">Newest</option>
                            <option value="products">Most products</option>
                        </select>
                        {q ? (
                            <input type="hidden" name="q" value={q} />
                        ) : null}
                        <button
                            type="submit"
                            className="h-9 rounded border bg-background px-3 text-sm"
                        >
                            Apply
                        </button>
                    </form>
                    {q || sort !== "name" ? (
                        <Link
                            href="/creators"
                            className="text-sm text-muted-foreground hover:underline"
                        >
                            Clear filters
                        </Link>
                    ) : null}
                </div>
            </header>

            {/* Creators */}
            <section className="mt-8">
                {directory.creators.length ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {directory.creators.map((creator) => (
                            <CreatorCard key={creator.id} creator={creator} />
                        ))}
                    </div>
                ) : (
                    <Card>
                        <CardContent className="p-6 text-sm text-muted-foreground">
                            {q
                                ? "No creators match your search."
                                : "No creators have published a page yet."}
                        </CardContent>
                    </Card>
                )}
            </section>

            {/* Pagination */}
            {directory.totalPages > 1 ? (
                <nav
                    className="mt-8 flex items-center justify-between"
                    aria-label="pagination"
                >
                    <Link
                        href={makeHref(Math.max(1, directory.page - 1))}
                        aria-disabled={directory.page === 1}
                        className={`text-sm ${directory.page === 1 ? "pointer-events-none opacity-50" : "hover:underline"}`}
                    >
                        ← Previous
                    </Link>
                    <div className="text-sm text-muted-foreground">
                        Page {directory.page} of {directory.totalPages}
                    </div>
                    <Link
                        href={makeHref(
                            Math.min(directory.totalPages, directory.page + 1),
                        )}
                        aria-disabled={directory.page === directory.totalPages}
                        className={`text-sm ${directory.page === directory.totalPages ? "pointer-events-none opacity-50" : "hover:underline"}`}
                    >
                        Next →
                    </Link>
                </nav>
            ) : null}

            {directory.totalPages > 1 ? (
                <p className="mt-8 text-xs text-muted-foreground">
                    Showing {directory.creators.length} of {directory.total}{" "}
                    creators, {directory.perPage} to a page.
                </p>
            ) : null}
        </div>
    );
}
