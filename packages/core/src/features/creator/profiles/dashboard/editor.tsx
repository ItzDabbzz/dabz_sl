"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
    BadgeCheck,
    CircleSlash,
    ExternalLink,
    Globe,
    Image as ImageIcon,
    Loader2,
    MapPin,
    Package,
    Plus,
    Save,
    Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { EmptyState, PanelToolbar } from "@/features/dashboard/components/page";
import { ImageField } from "@/components/shared/image-field";
import {
    ProfileAccount,
    ProfileApiError,
    ProfileDetail,
    ProfileItem,
    ProfileSummary,
    profileApi,
} from "./api";

/**
 * The screen where a creator changes their public page.
 *
 * The page has three parts and they are edited together, because they
 * are one thing: what the page says, the accounts it proves, and the
 * products it lists. A creator looking at their page wants to see it as
 * a whole, not as three forms.
 *
 * Everything is written through the API, so what the console does and
 * what the API allows are the same thing by construction.
 */

type Props = {
    profile: ProfileSummary;
    profiles: ProfileSummary[];
    orgs: number;
};

/** The fields of a page, as the form holds them. */
type Form = {
    displayName: string;
    slug: string;
    tagline: string;
    bio: string;
    avatarUrl: string;
    bannerUrl: string;
    websiteUrl: string;
    locations: string;
    published: boolean;
};

function toForm(detail: ProfileDetail): Form {
    return {
        displayName: detail.displayName ?? "",
        slug: detail.slug ?? "",
        tagline: detail.tagline ?? "",
        bio: detail.bio ?? "",
        avatarUrl: detail.avatarUrl ?? "",
        bannerUrl: detail.bannerUrl ?? "",
        websiteUrl: detail.websiteUrl ?? "",
        locations: detail.locations ?? "",
        published: !!detail.published,
    };
}

export function ProfileEditor({ profile, profiles, orgs }: Props) {
    const router = useRouter();

    const [detail, setDetail] = useState<ProfileDetail | null>(null);
    const [accounts, setAccounts] = useState<ProfileAccount[]>([]);
    const [items, setItems] = useState<ProfileItem[]>([]);
    const [form, setForm] = useState<Form | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // The account being claimed, and the product being looked for.
    const [newAccount, setNewAccount] = useState("");
    const [claiming, setClaiming] = useState(false);
    const [query, setQuery] = useState("");
    const [candidates, setCandidates] = useState<ProfileItem[]>([]);
    const [searching, setSearching] = useState(false);

    /**
     * Read the page and everything on it.
     *
     * This is the only way the screen learns anything: it asks the API
     * the same way anybody else would.
     */
    const load = useCallback(async (id: string) => {
        setLoading(true);
        try {
            const data = await profileApi<{
                profile: ProfileDetail;
                accounts: ProfileAccount[];
                items: ProfileItem[];
            }>(`/api/creator/profiles/${encodeURIComponent(id)}`);
            setDetail(data.profile);
            setAccounts(data.accounts ?? []);
            setItems(data.items ?? []);
            setForm(toForm(data.profile));
        } catch (error) {
            toast.error(
                error instanceof ProfileApiError
                    ? error.message
                    : "The page could not be loaded.",
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load(profile.id);
    }, [profile.id, load]);

    // The address the public page answers to.
    const publicPath = detail ? `/c/${detail.slug}` : "";

    // Whether the form has changed since it was loaded.
    const dirty = useMemo(() => {
        if (!form || !detail) return false;
        return toForm(detail) !== form;
    }, [form, detail]);

    async function save() {
        if (!detail || !form) return;
        setSaving(true);
        try {
            await profileApi(`/api/creator/profiles/${detail.id}`, {
                method: "PATCH",
                body: JSON.stringify({
                    displayName: form.displayName,
                    slug: form.slug,
                    tagline: form.tagline,
                    bio: form.bio,
                    avatarUrl: form.avatarUrl,
                    bannerUrl: form.bannerUrl,
                    websiteUrl: form.websiteUrl,
                    locations: form.locations,
                    published: form.published,
                }),
            });
            toast.success("Saved");
            await load(detail.id);
            router.refresh();
        } catch (error) {
            toast.error(
                error instanceof ProfileApiError
                    ? error.message
                    : "The page could not be saved.",
            );
        } finally {
            setSaving(false);
        }
    }

    /**
     * Remove the page.
     *
     * A page the creator does not want should be removable, not just
     * editable - otherwise a page made by mistake stays forever.
     */
    async function removeProfile() {
        if (!detail) return;
        if (
            !window.confirm(
                `Delete the page ${detail.slug}? Its posts stay, but the page and the accounts it proves are removed.`,
            )
        ) {
            return;
        }
        setSaving(true);
        try {
            await profileApi(`/api/creator/profiles/${detail.id}`, {
                method: "DELETE",
            });
            toast.success("The page was removed");
            router.push("/dashboard/profile");
            router.refresh();
        } catch (error) {
            toast.error(
                error instanceof ProfileApiError
                    ? error.message
                    : "The page could not be removed.",
            );
        } finally {
            setSaving(false);
        }
    }

    /** Publish or unpublish, without waiting for the whole form. */
    async function setPublished(next: boolean) {
        if (!detail) return;
        const previous = detail.published;
        setForm((current) =>
            current ? { ...current, published: next } : current,
        );
        try {
            await profileApi(`/api/creator/profiles/${detail.id}`, {
                method: "PATCH",
                body: JSON.stringify({ published: next }),
            });
            setDetail((current) =>
                current ? { ...current, published: next } : current,
            );
            toast.success(next ? "Your page is public." : "Your page is a draft.");
            router.refresh();
        } catch (error) {
            setForm((current) =>
                current ? { ...current, published: previous } : current,
            );
            toast.error(
                error instanceof ProfileApiError
                    ? error.message
                    : "The page could not be published.",
            );
        }
    }

    /** Claim a Second Life account. */
    async function claimAccount() {
        if (!detail || !newAccount.trim()) return;
        setClaiming(true);
        try {
            const data = await profileApi<{ account: ProfileAccount }>(
                `/api/creator/profiles/${detail.id}/accounts`,
                {
                    method: "POST",
                    body: JSON.stringify({ slAccountName: newAccount.trim() }),
                },
            );
            setAccounts((current) => [...current, data.account]);
            setNewAccount("");
            toast.success(
                "Account claimed. Put the code on an object in-world to prove it.",
            );
        } catch (error) {
            toast.error(
                error instanceof ProfileApiError
                    ? error.message
                    : "The account could not be claimed.",
            );
        } finally {
            setClaiming(false);
        }
    }

    /** Give up a claim. */
    async function removeAccount(accountId: string) {
        if (!detail) return;
        try {
            await profileApi(
                `/api/creator/profiles/${detail.id}/accounts/${encodeURIComponent(accountId)}`,
                { method: "DELETE" },
            );
            setAccounts((current) =>
                current.filter((account) => account.id !== accountId),
            );
            toast.success("Claim removed");
        } catch (error) {
            toast.error(
                error instanceof ProfileApiError
                    ? error.message
                    : "The claim could not be removed.",
            );
        }
    }

    /** Look for a product to list. */
    async function searchProducts() {
        if (!detail) return;
        setSearching(true);
        try {
            const data = await profileApi<{ items: ProfileItem[] }>(
                `/api/creator/profiles/${detail.id}/items?q=${encodeURIComponent(query)}`,
            );
            setCandidates(data.items ?? []);
        } catch (error) {
            toast.error(
                error instanceof ProfileApiError
                    ? error.message
                    : "The products could not be loaded.",
            );
        } finally {
            setSearching(false);
        }
    }

    /** List a product on the page. */
    async function addItem(itemId: string) {
        if (!detail) return;
        try {
            const data = await profileApi<{ item: ProfileItem }>(
                `/api/creator/profiles/${detail.id}/items`,
                {
                    method: "POST",
                    body: JSON.stringify({ itemId }),
                },
            );
            setItems((current) => [
                ...current.filter((item) => item.id !== data.item.id),
                data.item,
            ]);
            setCandidates((current) =>
                current.filter((item) => item.id !== data.item.id),
            );
            toast.success("Product listed");
        } catch (error) {
            toast.error(
                error instanceof ProfileApiError
                    ? error.message
                    : "The product could not be listed.",
            );
        }
    }

    /** Take a product off the page. */
    async function removeItem(itemId: string) {
        if (!detail) return;
        try {
            await profileApi(
                `/api/creator/profiles/${detail.id}/items/${encodeURIComponent(itemId)}`,
                { method: "DELETE" },
            );
            setItems((current) => current.filter((item) => item.id !== itemId));
            toast.success("Product removed");
        } catch (error) {
            toast.error(
                error instanceof ProfileApiError
                    ? error.message
                    : "The product could not be removed.",
            );
        }
    }

    if (loading || !form || !detail) {
        return (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading your page…
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Which page, and whether it is public */}
            <Card>
                <PanelToolbar className="justify-between">
                    <div className="flex min-w-0 items-center gap-2">
                        {profiles.length > 1 ? (
                            <Select
                                value={profile.id}
                                onValueChange={(next) => {
                                    router.push(`/dashboard/profile?page=${next}`);
                                }}
                            >
                                <SelectTrigger className="h-8 w-[280px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {profiles.map((row) => (
                                        <SelectItem key={row.id} value={row.id}>
                                            {row.displayName}
                                            {row.ownerName
                                                ? ` · ${row.ownerName}`
                                                : ""}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <span className="truncate text-sm font-medium">
                                {profile.displayName}
                            </span>
                        )}
                        <Badge variant={detail.published ? "default" : "secondary"}>
                            {detail.published ? "Public" : "Draft"}
                        </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            href={publicPath}
                            target="_blank"
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline"
                        >
                            View page
                            <ExternalLink className="h-3 w-3" />
                        </Link>
                    </div>
                </PanelToolbar>
                <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <Label htmlFor="published">Public page</Label>
                        <p className="text-xs text-muted-foreground">
                            A draft is only visible to you. Publishing puts
                            your page at {publicPath}.
                        </p>
                    </div>
                    <Switch
                        id="published"
                        checked={detail.published}
                        onCheckedChange={setPublished}
                    />
                </CardContent>
            </Card>

            {/* What the page says */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Your page</CardTitle>
                    <CardDescription>
                        The name, the address and the words the public sees.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="displayName">Display name</Label>
                            <Input
                                id="displayName"
                                value={form.displayName}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        displayName: event.target.value,
                                    })
                                }
                                placeholder="Moonlight Atelier"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="slug">Address</Label>
                            <div className="flex items-center gap-2">
                                <span className="shrink-0 text-sm text-muted-foreground">
                                    /c/
                                </span>
                                <Input
                                    id="slug"
                                    value={form.slug}
                                    onChange={(event) =>
                                        setForm({
                                            ...form,
                                            slug: event.target.value
                                                .toLowerCase()
                                                .replace(/[^a-z0-9-]/g, ""),
                                        })
                                    }
                                    placeholder="moonlight-atelier"
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Lowercase letters, numbers and dashes.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="tagline">Tagline</Label>
                        <Input
                            id="tagline"
                            value={form.tagline}
                            onChange={(event) =>
                                setForm({ ...form, tagline: event.target.value })
                            }
                            placeholder="Clothing for the night-time wanderer"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="bio">About</Label>
                        <Textarea
                            id="bio"
                            rows={5}
                            value={form.bio}
                            onChange={(event) =>
                                setForm({ ...form, bio: event.target.value })
                            }
                            placeholder="Who you are and what you make."
                        />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <ImageField
                            label="Avatar"
                            shape="square"
                            value={form.avatarUrl || null}
                            onChange={(next) =>
                                setForm({
                                    ...form,
                                    avatarUrl: next ?? "",
                                })
                            }
                            hint="A picture of you. An animated GIF is kept as it is."
                        />
                        <ImageField
                            label="Banner"
                            shape="wide"
                            value={form.bannerUrl || null}
                            onChange={(next) =>
                                setForm({
                                    ...form,
                                    bannerUrl: next ?? "",
                                })
                            }
                            hint="The picture across the top of your page."
                        />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="websiteUrl">
                                <Globe className="h-3.5 w-3.5" />
                                Website
                            </Label>
                            <Input
                                id="websiteUrl"
                                value={form.websiteUrl}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        websiteUrl: event.target.value,
                                    })
                                }
                                placeholder="https://example.com"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="locations">
                                <MapPin className="h-3.5 w-3.5" />
                                Locations
                            </Label>
                            <Textarea
                                id="locations"
                                rows={2}
                                value={form.locations}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        locations: event.target.value,
                                    })
                                }
                                placeholder="One location per line"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                        <Button
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={removeProfile}
                            disabled={saving}
                        >
                            <Trash2 className="h-4 w-4" />
                            Delete page
                        </Button>
                        <Button
                            onClick={save}
                            disabled={saving || !dirty}
                        >
                            {saving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4" />
                            )}
                            Save
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* The accounts the page proves */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">
                        Second Life accounts
                    </CardTitle>
                    <CardDescription>
                        The products of a verified account appear on your
                        page. A claim is not proof until the code is seen
                        on an object in-world.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                        <div className="flex-1 space-y-2">
                            <Label htmlFor="slAccountName">
                                Account name
                            </Label>
                            <Input
                                id="slAccountName"
                                value={newAccount}
                                onChange={(event) =>
                                    setNewAccount(event.target.value)
                                }
                                placeholder="Moonlight Atelier"
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        event.preventDefault();
                                        claimAccount();
                                    }
                                }}
                            />
                        </div>
                        <Button
                            onClick={claimAccount}
                            disabled={claiming || !newAccount.trim()}
                            variant="secondary"
                        >
                            {claiming ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Plus className="h-4 w-4" />
                            )}
                            Claim
                        </Button>
                    </div>

                    {accounts.length ? (
                        <div className="divide-y rounded-md border">
                            {accounts.map((account) => (
                                <div
                                    key={account.id}
                                    className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <div className="min-w-0 space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="truncate text-sm font-medium">
                                                {account.slAccountName}
                                            </span>
                                            {account.verified ? (
                                                <Badge
                                                    variant="outline"
                                                    className="gap-1"
                                                >
                                                    <BadgeCheck className="h-3 w-3 text-primary" />
                                                    Verified
                                                </Badge>
                                            ) : account.rejectedAt ? (
                                                <Badge
                                                    variant="outline"
                                                    className="gap-1 text-destructive"
                                                >
                                                    <CircleSlash className="h-3 w-3" />
                                                    Turned down
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary">
                                                    Awaiting proof
                                                </Badge>
                                            )}
                                        </div>
                                        {account.rejectedAt &&
                                        account.rejectionReason ? (
                                            <p className="text-xs text-muted-foreground">
                                                Turned down:{" "}
                                                {account.rejectionReason}. Put
                                                the new code on an object in
                                                Second Life and it can be
                                                tried again.
                                            </p>
                                        ) : null}
                                        {!account.verified &&
                                            account.verificationCode ? (
                                            <p className="text-xs text-muted-foreground">
                                                Put this code on an object in
                                                Second Life so the platform
                                                can see it:{" "}
                                                <span className="font-mono text-foreground">
                                                    {account.verificationCode}
                                                </span>
                                            </p>
                                        ) : null}
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                            removeAccount(account.id)
                                        }
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        Remove
                                    </Button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <EmptyState
                            title="No accounts claimed"
                            description="Claim the Second Life account you sell under, and its products will appear on your page once it is verified."
                        />
                    )}
                </CardContent>
            </Card>

            {/* The products the page lists */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Products</CardTitle>
                    <CardDescription>
                        You can list the products of an account the platform
                        has proven is yours, and the products in your own
                        catalogue.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                        <div className="flex-1 space-y-2">
                            <Label htmlFor="itemQuery">Find a product</Label>
                            <Input
                                id="itemQuery"
                                value={query}
                                onChange={(event) =>
                                    setQuery(event.target.value)
                                }
                                placeholder="Search by title or store"
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        event.preventDefault();
                                        searchProducts();
                                    }
                                }}
                            />
                        </div>
                        <Button
                            onClick={searchProducts}
                            disabled={searching}
                            variant="secondary"
                        >
                            {searching ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Package className="h-4 w-4" />
                            )}
                            Search
                        </Button>
                    </div>

                    {items.length ? (
                        <div className="divide-y rounded-md border">
                            {items.map((item) => (
                                <div
                                    key={item.id}
                                    className="flex items-center gap-3 px-3 py-3"
                                >
                                    {item.image ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={item.image}
                                            alt=""
                                            className="h-12 w-12 shrink-0 rounded object-cover"
                                        />
                                    ) : (
                                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-muted">
                                            <Package className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-sm font-medium">
                                            {item.title}
                                        </div>
                                        <div className="truncate text-xs text-muted-foreground">
                                            {item.price ? `${item.price} L$` : ""}
                                            {item.store ? ` · ${item.store}` : ""}
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => removeItem(item.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        Remove
                                    </Button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <EmptyState
                            title="No products listed"
                            description="Search for a product above to put it on your page."
                        />
                    )}

                    {candidates.length ? (
                        <div className="space-y-2">
                            <div className="text-sm font-medium">
                                Products you can list
                            </div>
                            <div className="divide-y rounded-md border">
                                {candidates.map((item) => (
                                    <div
                                        key={item.id}
                                        className="flex items-center gap-3 px-3 py-3"
                                    >
                                        {item.image ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={item.image}
                                                alt=""
                                                className="h-12 w-12 shrink-0 rounded object-cover"
                                            />
                                        ) : (
                                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-muted">
                                                <Package className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-sm font-medium">
                                                {item.title}
                                            </div>
                                            <div className="truncate text-xs text-muted-foreground">
                                                {item.price
                                                    ? `${item.price} L$`
                                                    : ""}
                                                {item.store
                                                    ? ` · ${item.store}`
                                                    : ""}
                                            </div>
                                        </div>
                                        {item.featured ? (
                                            <Badge variant="secondary">
                                                Listed
                                            </Badge>
                                        ) : (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    addItem(item.id)
                                                }
                                            >
                                                <Plus className="h-4 w-4" />
                                                List
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </CardContent>
            </Card>
        </div>
    );
}
