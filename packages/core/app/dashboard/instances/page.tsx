import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InstancesTable, type InstanceItem } from "./components/table";
import { absoluteUrl } from "@/lib/absolute-url";

export default async function InstancesPage() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session) return redirect("/sign-in");

  const hdrs = await headers();
  const base = absoluteUrl(hdrs);
  const res = await fetch(`${base}/api/creator/instances`, { headers: { Authorization: hdrs.get("authorization") || "" } });
  const data = await res.json().catch(() => ({ items: [] }));
  const items: InstanceItem[] = (data?.items || []).map((x: any) => ({ id: x.id, ownerSlUuid: x.ownerSlUuid, status: x.status, region: x.region, version: x.version }));

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-xl font-semibold">Instances</h1>
      <Card>
        <CardHeader>
          <CardTitle>Instances</CardTitle>
        </CardHeader>
        <CardContent>
          <InstancesTable items={items} />
        </CardContent>
      </Card>
    </div>
  );
}
