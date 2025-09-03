import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiKeysTable, type ApiKeyItem } from "./components/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { absoluteUrl } from "@/lib/absolute-url";
import WorkInProgressNotice from "@/components/wip-notice";

export default async function ApiKeysPage() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session) return redirect("/sign-in");

  const hdrs = await headers();
  const base = absoluteUrl(hdrs);
  const res = await fetch(`${base}/api/creator/apikeys`, { headers: { Authorization: hdrs.get("authorization") || "" } });
  const data = await res.json().catch(() => ({ items: [] }));
  const items: ApiKeyItem[] = (data?.items || []).map((x: any) => ({ id: x.id, name: x.name, createdAt: x.createdAt, lastUsedAt: x.lastUsedAt }));

  async function revokeKey(formData: FormData) {
    'use server';
    const id = String(formData.get('id') || '');
    const hdrs2 = await headers();
    const base2 = absoluteUrl(hdrs2);
    await fetch(`${base2}/api/creator/apikeys?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Authorization: hdrs2.get('authorization') || '' } });
  }

  async function createKey(formData: FormData) {
    'use server';
    const name = String(formData.get('name') || 'New Key');
    const scopes = String(formData.get('scopes') || '').split(/\s+/).filter(Boolean);
    const hdrs2 = await headers();
    const base2 = absoluteUrl(hdrs2);
    await fetch(`${base2}/api/creator/apikeys`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: hdrs2.get('authorization') || '' }, body: JSON.stringify({ name, scopes }) });
  }

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
          <div className="mt-4 space-y-2">
            {items.map((k) => (
              <form key={k.id} action={revokeKey} className="flex items-center justify-between border rounded-md p-2">
                <div className="text-xs text-muted-foreground truncate">
                  Revoke key <span className="font-mono">{k.id}</span>
                </div>
                <input type="hidden" name="id" value={k.id} />
                <Button variant="destructive" size="sm" type="submit">Revoke</Button>
              </form>
            ))}
          </div>
        </CardContent>
        <CardFooter>
          <form action={createKey} className="w-full grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <Input name="name" placeholder="Key name" />
            <Input name="scopes" placeholder="Scopes (space separated) e.g. sl.objects:read sl.instances:write" />
            <Button type="submit">Create</Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
