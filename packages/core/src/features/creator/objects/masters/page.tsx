import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { MasterObjectsTable, type MasterObject } from "./components/columns";
import WorkInProgressNotice from "@/components/shared/work-in-progress-notice";
import { getOptionalSession } from "@/server/auth/session";
import { fetchInternalApiJson } from "@/server/services/internal-api";

export default async function ObjectsPage() {
  const session = await getOptionalSession();
  if (!session) return redirect("/sign-in");

  const data = await fetchInternalApiJson<{ items?: unknown[] }>(
    "/api/creator/master-objects",
    { items: [] },
  );
  const items: MasterObject[] = (data?.items || []).map((x: any) => ({ id: x.id, name: x.name, description: x.description, currentVersion: x.currentVersion || 1 }));

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Master Objects</h1>
        <Link href="/dashboard/database/objects/new" className="text-sm underline">New Object</Link>
      </div>
      <WorkInProgressNotice className="mb-2" message="This Second Life database section is under active development and not in a working state." />
      <Card>
        <CardHeader>
          <CardTitle>Objects</CardTitle>
        </CardHeader>
        <CardContent>
          <MasterObjectsTable items={items} />
          <div className="mt-4 text-xs text-muted-foreground">Click a row to edit.</div>
        </CardContent>
      </Card>
    </div>
  );
}
