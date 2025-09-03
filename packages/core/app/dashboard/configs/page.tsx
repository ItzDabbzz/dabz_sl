import React from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfigsTable, type ConfigItem } from "./components/table";
import { absoluteUrl } from "@/lib/absolute-url";
import WorkInProgressNotice from "@/components/wip-notice";

export default async function ConfigsPage() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session) return redirect("/sign-in");

  const hdrs = await headers();
  const base = absoluteUrl(hdrs);
  const res = await fetch(`${base}/api/creator/configs`, { headers: { Authorization: hdrs.get("authorization") || "" } });
  const data = await res.json().catch(() => ({ items: [] }));
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
