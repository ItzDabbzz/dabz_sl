import React from "react";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EntitlementsTable, type EntitlementItem } from "./components/table";
import WorkInProgressNotice from "@/components/wip-notice";
import { getOptionalSession } from "@/server/auth/session";
import { fetchInternalApiJson } from "@/server/services/internal-api";

export default async function EntitlementsPage() {
  const session = await getOptionalSession();
  if (!session) return redirect("/sign-in");

  const data = await fetchInternalApiJson<{ items?: unknown[] }>(
    "/api/creator/entitlements",
    { items: [] },
  );
  const items: EntitlementItem[] = (data?.items || []).map((x: any) => ({ id: x.id, ownerSlUuid: x.ownerSlUuid, masterObjectId: x.masterObjectId, source: x.source, createdAt: x.createdAt }));

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-xl font-semibold">Entitlements</h1>
      <WorkInProgressNotice className="-mt-2" message="This Second Life database section is under active development and not in a working state." />
      <Card>
        <CardHeader>
          <CardTitle>Entitlements</CardTitle>
        </CardHeader>
        <CardContent>
          <EntitlementsTable items={items} />
        </CardContent>
      </Card>
    </div>
  );
}
