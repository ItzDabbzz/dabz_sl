import ExplorerClient from "./components/ExplorerClient";
import { DashboardPage } from "@/features/dashboard/components/page";
import { StaffOnly } from "@/features/dashboard/components/staff-only";

export const dynamic = "force-dynamic";

/**
 * Marketplace Explorer page (Server Component)
 * - Staff only; renders the interactive client explorer for staff.
 */
export default async function ExplorerPage() {
    return (
        <DashboardPage
            title="Marketplace Explorer"
            description="Browse, filter, and organize marketplace items. Use the category picker per item to assign categories."
            crumbs={[
                { label: "Console", href: "/dashboard" },
                { label: "Marketplace" },
                { label: "Explorer" },
            ]}
        >
            <StaffOnly
                deniedDescription="The marketplace catalogue is managed by staff."
            >
                <div className="rounded-lg border p-4 space-y-4">
                    <ExplorerClient />
                </div>
            </StaffOnly>
        </DashboardPage>
    );
}
