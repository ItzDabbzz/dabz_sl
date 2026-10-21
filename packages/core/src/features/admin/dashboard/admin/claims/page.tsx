import Link from "next/link";
import { ShieldCheck, Clock, CircleCheck, CircleSlash } from "lucide-react";
import {
    DashboardPage,
    EmptyState,
    StatCard,
} from "@/features/dashboard/components/page";
import { StaffOnly } from "@/features/dashboard/components/staff-only";
import {
    ClaimRow,
    ClaimState,
    listClaims,
} from "@/features/creator/profiles/server/claims";
import { ClaimActions } from "./actions";

/**
 * The queue of claims waiting for a decision.
 *
 * A creator claims a Second Life account and their page carries a
 * one-time code. Someone has to look at the object in-world and see
 * whether the code is really on it. That is staff work, and this is where
 * it is done.
 *
 * The claims that have been decided stay on the page underneath, so the
 * record of who was proved - and who was turned down, and why - is one
 * scroll away rather than gone.
 */

/** How a claim should read, per state. */
const STATE_LABEL: Record<ClaimState, string> = {
    pending: "Waiting for a decision",
    "turned-down": "Turned down",
    approved: "Approved",
};

function ClaimRowView({
    claim,
    showActions,
}: {
    claim: ClaimRow;
    showActions: boolean;
}) {
    return (
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                        {claim.slAccountName}
                    </span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                        {STATE_LABEL[claim.state]}
                    </span>
                </div>
                <div className="text-xs text-muted-foreground">
                    claimed by{" "}
                    <Link
                        href={`/c/${claim.profileSlug}`}
                        className="underline underline-offset-4"
                    >
                        {claim.profileName}
                    </Link>{" "}
                    ({claim.ownerName})
                </div>
                <div className="text-xs text-muted-foreground">
                    claimed on{" "}
                    {claim.createdAt.toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                    })}
                </div>
                {claim.slAccountUuid ? (
                    <div className="text-xs text-muted-foreground">
                        UUID {claim.slAccountUuid}
                    </div>
                ) : null}
                {claim.state === "turned-down" && claim.rejectionReason ? (
                    <div className="text-xs text-muted-foreground">
                        Reason: {claim.rejectionReason}
                    </div>
                ) : null}
                {claim.state === "approved" && claim.verifiedAt ? (
                    <div className="text-xs text-muted-foreground">
                        proved on{" "}
                        {claim.verifiedAt.toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                        })}
                    </div>
                ) : null}
            </div>

            <div className="flex flex-col items-stretch gap-2 sm:items-end">
                {claim.state === "approved" ? (
                    <div className="text-xs text-muted-foreground">
                        Proved. The code is spent.
                    </div>
                ) : claim.verificationCode ? (
                    <div className="text-right">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            code on the object
                        </div>
                        <code className="rounded bg-muted px-2 py-1 text-sm tracking-[0.2em]">
                            {claim.verificationCode}
                        </code>
                    </div>
                ) : (
                    <div className="text-xs text-muted-foreground">
                        No code on file.
                    </div>
                )}
                {showActions ? (
                    <ClaimActions
                        profileId={claim.profileId}
                        accountId={claim.id}
                        accountName={claim.slAccountName}
                    />
                ) : null}
            </div>
        </div>
    );
}

export default async function CreatorClaimsPage() {
    const claims = await listClaims();

    const waiting = claims.filter((claim) => claim.state === "pending");
    const turnedDown = claims.filter((claim) => claim.state === "turned-down");
    const approved = claims.filter((claim) => claim.state === "approved");

    const oldest = waiting.length ? waiting[0] : null;

    return (
        <StaffOnly
            deniedTitle="Staff only"
            deniedDescription="Deciding a creator's account claim is the work of the people who run the site."
        >
            <DashboardPage
                title="Creator claims"
                description="Second Life accounts creators have claimed. Look at the object in-world, check the code on it, then decide."
                crumbs={[
                    { label: "Console", href: "/dashboard" },
                    { label: "Admin" },
                    { label: "Creator claims" },
                ]}
            >
                <div className="grid gap-4 sm:grid-cols-3">
                    <StatCard
                        label="Waiting for a decision"
                        value={waiting.length}
                        icon={<Clock className="h-4 w-4" aria-hidden="true" />}
                    />
                    <StatCard
                        label="Oldest claim"
                        value={
                            oldest
                                ? oldest.createdAt.toLocaleDateString(undefined, {
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric",
                                  })
                                : "—"
                        }
                        hint={oldest ? oldest.slAccountName : "Nothing waiting"}
                        icon={
                            <ShieldCheck
                                className="h-4 w-4"
                                aria-hidden="true"
                            />
                        }
                    />
                    <StatCard
                        label="Decided"
                        value={`${approved.length} approved · ${turnedDown.length} turned down`}
                        icon={
                            <CircleCheck
                                className="h-4 w-4"
                                aria-hidden="true"
                            />
                        }
                    />
                </div>

                <section className="space-y-3">
                    <h2 className="text-sm font-semibold">
                        Waiting for a decision
                    </h2>
                    {waiting.length ? (
                        <div className="divide-y rounded-lg border">
                            {waiting.map((claim) => (
                                <ClaimRowView
                                    key={claim.id}
                                    claim={claim}
                                    showActions
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-lg border">
                            <EmptyState
                                icon={
                                    <ShieldCheck
                                        className="h-6 w-6"
                                        aria-hidden="true"
                                    />
                                }
                                title="No claims waiting"
                                description="When a creator claims a Second Life account, it turns up here with the code to check."
                            />
                        </div>
                    )}
                </section>

                {turnedDown.length ? (
                    <section className="space-y-3">
                        <h2 className="flex items-center gap-2 text-sm font-semibold">
                            <CircleSlash
                                className="h-4 w-4 text-muted-foreground"
                                aria-hidden="true"
                            />
                            Turned down
                        </h2>
                        <div className="divide-y rounded-lg border">
                            {turnedDown.map((claim) => (
                                <ClaimRowView
                                    key={claim.id}
                                    claim={claim}
                                    showActions
                                />
                            ))}
                        </div>
                    </section>
                ) : null}

                {approved.length ? (
                    <section className="space-y-3">
                        <h2 className="flex items-center gap-2 text-sm font-semibold">
                            <CircleCheck
                                className="h-4 w-4 text-muted-foreground"
                                aria-hidden="true"
                            />
                            Approved
                        </h2>
                        <div className="divide-y rounded-lg border">
                            {approved.map((claim) => (
                                <ClaimRowView
                                    key={claim.id}
                                    claim={claim}
                                    showActions={false}
                                />
                            ))}
                        </div>
                    </section>
                ) : null}
            </DashboardPage>
        </StaffOnly>
    );
}
