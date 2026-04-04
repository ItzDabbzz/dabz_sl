import React from "react";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfigsTable, type ConfigItem } from "./components/table";
import WorkInProgressNotice from "@/components/shared/work-in-progress-notice";
import { getOptionalSession } from "@/server/auth/session";
import { fetchInternalApiJson } from "@/server/services/internal-api";

export default async function ConfigsPage() {
  const session = await getOptionalSession();
  if (!session) return redirect("/sign-in");

  const data = await fetchInternalApiJson<{ items?: unknown[] }>(
    "/api/creator/configs",
    { items: [] },
  );
  const items: ConfigItem[] = (data?.items || []).map((x: any) => ({ id: x.id, instanceId: x.instanceId, createdAt: x.createdAt, versionTag: x.versionTag }));

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-xl font-semibold">Configs</h1>
      <WorkInProgressNotice className="-mt-2" message="This Second Life database section is under active development and not in a working state." />
      <Card>
        <CardHeader>
          <CardTitle>Recent Configs</CardTitle>
        </CardHeader>
        <CardContent>
          <ConfigsTable items={items} />
        </CardContent>
      </Card>
    </div>
  );
}
