import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InstancesTable, type InstanceItem } from "./components/table";
import WorkInProgressNotice from "@/components/shared/work-in-progress-notice";
import { getOptionalSession } from "@/server/auth/session";
import { fetchInternalApiJson } from "@/server/services/internal-api";
import { DashboardPage } from "@/features/dashboard/components/page";

export default async function InstancesPage() {
    const session = await getOptionalSession();
    if (!session) return redirect("/sign-in");

    const data = await fetchInternalApiJson<{ items?: unknown[] }>(
        "/api/creator/instances",
        { items: [] },
    );
    const items: InstanceItem[] = (data?.items || []).map((x: any) => ({ id: x.id, ownerSlUuid: x.ownerSlUuid, status: x.status, region: x.region, version: x.version }));

    return (
        <DashboardPage
            title="Instances"
            crumbs={[
                { label: "Console", href: "/dashboard" },
                { label: "SL Data" },
                { label: "Instances" },
            ]}
        >
            <WorkInProgressNotice message="This Second Life database section is under active development and not in a working state." />
            <Card>
                <CardHeader>
                    <CardTitle>Instances</CardTitle>
                </CardHeader>
                <CardContent>
                    <InstancesTable items={items} />
                </CardContent>
            </Card>
        </DashboardPage>
    );
}
