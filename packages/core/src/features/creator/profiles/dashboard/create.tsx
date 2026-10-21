"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
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
import { ProfileApiError, profileApi } from "./api";

/**
 * The first thing a creator sees when they have no page yet.
 *
 * A page is made here and it starts as a draft - the creator can look at
 * it, change it, and publish it when it is ready. The address is derived
 * from the name unless the creator wants a different one.
 */
export function CreateProfilePanel() {
    const router = useRouter();
    const [displayName, setDisplayName] = useState("");
    const [slug, setSlug] = useState("");
    const [creating, setCreating] = useState(false);

    async function create() {
        if (!displayName.trim()) return;
        setCreating(true);
        try {
            const data = await profileApi<{ profile: { id: string } }>(
                "/api/creator/profiles",
                {
                    method: "POST",
                    body: JSON.stringify({
                        ownerType: "user",
                        displayName: displayName.trim(),
                        ...(slug.trim() ? { slug: slug.trim() } : {}),
                    }),
                },
            );
            toast.success("Your page is ready. Publish it when it looks right.");
            router.push(`/dashboard/profile?page=${data.profile.id}`);
            router.refresh();
        } catch (error) {
            toast.error(
                error instanceof ProfileApiError
                    ? error.message
                    : "The page could not be created.",
            );
        } finally {
            setCreating(false);
        }
    }

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base">Create your public page</CardTitle>
                <CardDescription>
                    Your page gathers your posts, your products and the
                    Second Life accounts you have proven you own. It starts
                    as a draft, so nobody sees it until you publish it.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="newDisplayName">Display name</Label>
                        <Input
                            id="newDisplayName"
                            value={displayName}
                            onChange={(event) =>
                                setDisplayName(event.target.value)
                            }
                            placeholder="Your studio name"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="newSlug">Address</Label>
                        <div className="flex items-center gap-2">
                            <span className="shrink-0 text-sm text-muted-foreground">
                                /c/
                            </span>
                            <Input
                                id="newSlug"
                                value={slug}
                                onChange={(event) =>
                                    setSlug(
                                        event.target.value
                                            .toLowerCase()
                                            .replace(/[^a-z0-9-]/g, ""),
                                    )
                                }
                                placeholder="your-studio"
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Leave this empty and we will make one from your
                            name.
                        </p>
                    </div>
                </div>
                <div className="flex justify-end">
                    <Button
                        onClick={create}
                        disabled={creating || !displayName.trim()}
                    >
                        {creating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Sparkles className="h-4 w-4" />
                        )}
                        Create page
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
