"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * The decision buttons on a claim.
 *
 * Proving a claim is staff work: staff look at the object in-world, see
 * the code on it, and only then approve. A refusal carries a reason, so
 * the creator knows what to fix and the record of the decision is worth
 * something later.
 */
export function ClaimActions({
    profileId,
    accountId,
    accountName,
}: {
    profileId: string;
    accountId: string;
    accountName: string;
}) {
    const router = useRouter();
    const [, startTransition] = useTransition();
    const [busy, setBusy] = useState<"verify" | "reject" | null>(null);
    const [reason, setReason] = useState("");
    const [error, setError] = useState<string | null>(null);

    const run = async (action: "verify" | "reject") => {
        setBusy(action);
        setError(null);
        try {
            const base = `/api/creator/profiles/${profileId}/accounts/${accountId}`;
            const response = await fetch(`${base}/verify`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(
                    action === "verify"
                        ? { verified: true }
                        : {
                              verified: false,
                              reason: reason.trim() || undefined,
                          },
                ),
            });

            if (!response.ok) {
                const body = await response.json().catch(() => null);
                setError(
                    body?.message ||
                        (action === "verify"
                            ? "The claim could not be approved."
                            : "The claim could not be turned down."),
                );
                return;
            }
            setReason("");
            startTransition(() => router.refresh());
        } catch {
            setError("The claim could not be reached.");
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <div className="flex flex-wrap items-center justify-end gap-2">
                <Input
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Reason, if turning it down"
                    aria-label={`Reason for turning down the claim on ${accountName}`}
                    className="h-8 w-full sm:w-56"
                    maxLength={500}
                />
                <Button
                    size="sm"
                    onClick={() => run("verify")}
                    disabled={busy !== null}
                >
                    <Check className="h-4 w-4" aria-hidden="true" />
                    {busy === "verify" ? "Approving…" : "Approve"}
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => run("reject")}
                    disabled={busy !== null}
                >
                    <X className="h-4 w-4" aria-hidden="true" />
                    {busy === "reject" ? "Turning down…" : "Turn down"}
                </Button>
            </div>
            {error ? (
                <p className="text-xs text-destructive">{error}</p>
            ) : null}
        </div>
    );
}
