import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { MasterObjectsTable, type MasterObject } from "./components/columns";
import { absoluteUrl } from "@/lib/absolute-url";
import WorkInProgressNotice from "@/components/wip-notice";

export default async function ObjectsPage() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session) return redirect("/sign-in");

  const hdrs = await headers();
  const base = absoluteUrl(hdrs);
  // Forward only cookie so the API authenticates via first-party session
  const outHeaders = new Headers();
  const cookie = hdrs.get("cookie");
  if (cookie) outHeaders.set("cookie", cookie);
  const res = await fetch(`${base}/api/creator/master-objects`, { headers: outHeaders });
  const data = await res.json().catch(() => ({ items: [] }));
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
