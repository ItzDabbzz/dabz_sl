import { redirect } from "next/navigation";
import { getOptionalSession } from "@/server/auth/session";
import { getManagedOrgIds } from "@/features/creator/profiles/server/ownership";
import { listManageableProfiles } from "@/features/creator/profiles/server/manage";
import { DashboardPage } from "@/features/dashboard/components/page";
import { CreateProfilePanel } from "./create";
import { ProfileEditor } from "./editor";

/**
 * The creator's own page, in the console.
 *
 * This is where a creator changes the page the public sees: the name it
 * answers to, what it says, the Second Life accounts it proves, and the
 * products it lists.
 *
 * A creator may have more than one page - one of their own, and one for
 * each team they run - so the screen picks between them rather than
 * assuming there is only one.
 */
export const dynamic = "force-dynamic";

export default async function CreatorProfileDashboard({
    searchParams,
}: {
    searchParams: Promise<{ page?: string }>;
}) {
    const session = await getOptionalSession();
    const user = (session as any)?.user;
    if (!user?.id) return redirect("/sign-in");

    const orgIds = await getManagedOrgIds(user.id);
    const profiles = await listManageableProfiles({
        userId: user.id,
        orgIds,
    });

    const params = await searchParams;
    const requested = params?.page;
    const active =
        profiles.find((profile) => profile.id === requested) ??
        profiles[0] ??
        null;

    return (
        <DashboardPage
            title="Public Page"
            description="Your public creator page: what it says, the Second Life accounts it proves, and the products it lists."
            crumbs={[
                { label: "Console", href: "/dashboard" },
                { label: "Public Page" },
            ]}
        >
            {active ? (
                <ProfileEditor
                    profile={active}
                    profiles={profiles.map((profile) => ({
                        id: profile.id,
                        slug: profile.slug,
                        displayName: profile.displayName,
                        ownerType: profile.ownerType,
                        ownerName: profile.ownerName,
                        published: profile.published,
                    }))}
                    orgs={orgIds.length}
                />
            ) : (
                <CreateProfilePanel />
            )}
        </DashboardPage>
    );
}
