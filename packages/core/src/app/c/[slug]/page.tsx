import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BadgeCheck, ExternalLink, MapPin, Package, Rss } from "lucide-react";
import {
    getProfileBySlug,
    getProfileItems,
    getProfilePosts,
} from "@/features/creator/profiles/server/profile";
import { getOptionalSession } from "@/server/auth/session";
import { postPath } from "@/features/creator/blog/server/handle";
import { getManagedOrgIds } from "@/features/creator/profiles/server/ownership";

export const revalidate = 60;

/**
 * A creator's public page.
 *
 * Everything on it is the creator's own: the posts they wrote, the
 * products of the Second Life accounts they have proven they own, and
 * the accounts themselves. Nothing here is edited by staff.
 */
export default async function CreatorPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const profile = await getProfileBySlug(slug);
    if (!profile) return notFound();

    // A page that is not published yet is a draft: its owner may look at
    // it, nobody else may. A team page is owned by the organization, so
    // the viewer is one of the people who run it.
    if (!profile.published) {
        const session = await getOptionalSession();
        const viewer = (session as any)?.user;
        if (!viewer) return notFound();

        if (profile.ownerType === "user") {
            if (viewer.id !== profile.ownerId) return notFound();
        } else {
            const managed = await getManagedOrgIds(viewer.id);
            if (!managed.includes(profile.ownerId)) return notFound();
        }
    }

    const [items, posts] = await Promise.all([
        getProfileItems(profile.id),
        getProfilePosts(profile.ownerType, profile.ownerId),
    ]);

    const initials = profile.displayName.trim().slice(0, 2).toUpperCase();

    return (
        <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
            {/* Header */}
            <header className="overflow-hidden rounded-xl border bg-card">
                {profile.bannerUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={profile.bannerUrl}
                        alt=""
                        className="h-40 w-full object-cover sm:h-52"
                    />
                ) : (
                    <div className="h-24 w-full bg-gradient-to-r from-primary/20 via-primary/10 to-transparent sm:h-32" />
                )}
                <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-end">
                    <Avatar className="h-20 w-20 shrink-0 border-2">
                        {profile.avatarUrl ? (
                            <AvatarImage src={profile.avatarUrl} alt="" />
                        ) : null}
                        <AvatarFallback className="text-lg">
                            {initials}
                        </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 space-y-1">
                        <h1 className="text-2xl font-semibold tracking-tight">
                            {profile.displayName}
                        </h1>
                        {profile.tagline ? (
                            <p className="text-sm text-muted-foreground">
                                {profile.tagline}
                            </p>
                        ) : null}
                        {profile.websiteUrl ? (
                            <a
                                href={profile.websiteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline"
                            >
                                <ExternalLink className="h-3 w-3" />
                                {profile.websiteUrl.replace(/^https?:\/\//, "")}
                            </a>
                        ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                        {profile.verifiedAccounts.map((account) => (
                            <Badge
                                key={account.name}
                                variant="outline"
                                className="gap-1"
                            >
                                <BadgeCheck className="h-3 w-3 text-primary" />
                                {account.name}
                            </Badge>
                        ))}
                    </div>
                </div>
                {profile.bio ? (
                    <div className="border-t px-6 py-4 text-sm leading-relaxed text-muted-foreground">
                        {profile.bio}
                    </div>
                ) : null}
                {profile.locations ? (
                    <div className="flex items-center gap-2 border-t px-6 py-3 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        <span className="whitespace-pre-line">
                            {profile.locations}
                        </span>
                    </div>
                ) : null}
            </header>

            {/*
                * Two panes side by side: the products are the long list, the
                * posts sit beside them and stay in view, so a creator with
                * a hundred products does not push their writing off the
                * page.
                */}
            <div className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
                {/* Products */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="flex items-center gap-2 text-lg font-semibold">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            Products
                        </h2>
                        <Button asChild variant="ghost" size="sm">
                            <Link href="/marketplace">
                                Browse the marketplace
                            </Link>
                        </Button>
                    </div>
                    {items.length ? (
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {items.map((item) => {
                                const creator = item.creator as
                                    | { name?: string; link?: string }
                                    | null;
                                const images = (item.images ?? []) as string[];
                                return (
                                    <Card
                                        key={String(item.id)}
                                        className="overflow-hidden"
                                    >
                                        {images[0] ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={images[0]}
                                                alt={item.title}
                                                className="h-40 w-full object-cover"
                                            />
                                        ) : null}
                                        <CardContent className="space-y-1 p-4">
                                            <div className="line-clamp-2 text-sm font-medium">
                                                {item.title}
                                            </div>
                                            {item.price ? (
                                                <div className="text-sm text-muted-foreground">
                                                    {item.price} L$
                                                </div>
                                            ) : null}
                                            {creator?.name ? (
                                                <div className="text-xs text-muted-foreground">
                                                    {creator.name}
                                                </div>
                                            ) : null}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    ) : (
                        <Card>
                            <CardContent className="p-6 text-sm text-muted-foreground">
                                {profile.verifiedAccounts.length
                                    ? "No products found for the verified accounts yet."
                                    : "No products yet. Once a Second Life account is verified, the products sold under it appear here."}
                            </CardContent>
                        </Card>
                    )}
                </section>

                {/* Posts */}
                <section className="space-y-4 lg:sticky lg:top-6">
                    <h2 className="flex items-center gap-2 text-lg font-semibold">
                        <Rss className="h-4 w-4 text-muted-foreground" />
                        Posts
                    </h2>
                    {posts.length ? (
                        <div className="space-y-3">
                            {posts.map((post) => (
                                <Link
                                    key={post.id}
                                    href={postPath(profile.slug, post.slug)}
                                    className="block rounded-lg border bg-card p-4 transition-colors hover:bg-muted/40"
                                >
                                    <div className="text-sm font-medium">
                                        {post.title}
                                    </div>
                                    {post.excerpt ? (
                                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                            {post.excerpt}
                                        </p>
                                    ) : null}
                                    {post.publishedAt ? (
                                        <div className="mt-2 text-xs text-muted-foreground">
                                            {new Date(
                                                post.publishedAt,
                                            ).toLocaleDateString(undefined, {
                                                year: "numeric",
                                                month: "short",
                                                day: "numeric",
                                            })}
                                        </div>
                                    ) : null}
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <Card>
                            <CardContent className="p-6 text-sm text-muted-foreground">
                                No posts yet.
                            </CardContent>
                        </Card>
                    )}
                </section>
            </div>
        </div>
    );
}
