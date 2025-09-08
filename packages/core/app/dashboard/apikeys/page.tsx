import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiKeysTable, type ApiKeyItem } from "./components/table";
import { absoluteUrl } from "@/lib/absolute-url";
import WorkInProgressNotice from "@/components/wip-notice";
import { ActionsClient } from "./actions-client";

export default async function ApiKeysPage() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session) return redirect("/sign-in");

  const hdrs = await headers();
  const base = absoluteUrl(hdrs);
  const res = await fetch(`${base}/api/creator/apikeys`, {
    headers: {
      Authorization: hdrs.get("authorization") || "",
      Cookie: hdrs.get("cookie") || "",
    },
  });
  const data = await res.json().catch(() => ({ items: [] }));
  const items: ApiKeyItem[] = (data?.items || []).map((x: any) => ({ id: x.id, name: x.name, createdAt: x.createdAt, lastUsedAt: x.lastUsedAt }));

  // Actions handled client-side in ActionsClient for better error UX

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-xl font-semibold">API Keys</h1>
      <WorkInProgressNotice className="-mt-2" message="This Second Life database section is under active development and not in a working state." />
      <Card>
        <CardHeader>
          <CardTitle>Keys</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Presentational table */}
          <ApiKeysTable items={items} />
          {/* Actions per key */}
          <ActionsClient items={items} />
        </CardContent>
        <CardFooter>
          {/* Duplicated in ActionsClient */}
        </CardFooter>
      </Card>
    </div>
  );
}
