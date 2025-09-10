import React from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EntitlementsTable, type EntitlementItem } from "./components/table";
import { absoluteUrl } from "@/lib/absolute-url";
import WorkInProgressNotice from "@/components/wip-notice";

export default async function EntitlementsPage() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session) return redirect("/sign-in");

  const hdrs = await headers();
  const base = absoluteUrl(hdrs);
  const outHeaders = new Headers();
  const cookie = hdrs.get("cookie");
  if (cookie) outHeaders.set("cookie", cookie);
  const res = await fetch(`${base}/api/creator/entitlements`, { headers: outHeaders });
  const data = await res.json().catch(() => ({ items: [] }));
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
