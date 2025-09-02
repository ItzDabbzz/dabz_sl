import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { WebhooksTable, type WebhookItem } from "./components/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { absoluteUrl } from "@/lib/absolute-url";

export default async function WebhooksPage() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session) return redirect("/sign-in");

  const hdrs = await headers();
  const base = absoluteUrl(hdrs);
  const res = await fetch(`${base}/api/creator/webhooks`, { headers: { Authorization: hdrs.get("authorization") || "" } });
  const data = await res.json().catch(() => ({ items: [] }));
  const items: WebhookItem[] = (data?.items || []).map((x: any) => ({ id: x.id, targetUrl: x.targetUrl, active: x.active, events: x.events || [] }));

  async function deactivate(formData: FormData) {
    'use server';
    const id = String(formData.get('id') || '');
    const hdrs2 = await headers();
    const base2 = absoluteUrl(hdrs2);
    await fetch(`${base2}/api/creator/webhooks/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: hdrs2.get('authorization') || '' }, body: JSON.stringify({ active: false }) });
  }

  async function create(formData: FormData) {
    'use server';
    const url = String(formData.get('url') || '');
    const events = String(formData.get('events') || '').split(/\s*,\s*/).filter(Boolean);
    const secret = String(formData.get('secret') || '');
    const hdrs2 = await headers();
    const base2 = absoluteUrl(hdrs2);
    await fetch(`${base2}/api/creator/webhooks`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: hdrs2.get('authorization') || '' }, body: JSON.stringify({ targetUrl: url, events, secret }) });
  }

  async function test(formData: FormData) {
    'use server';
    const id = String(formData.get('id') || '');
    const hdrs2 = await headers();
    const base2 = absoluteUrl(hdrs2);
    await fetch(`${base2}/api/creator/webhooks/test`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: hdrs2.get('authorization') || '' }, body: JSON.stringify({ webhookId: id, event: 'test.ping', payload: { hello: 'world' } }) });
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-xl font-semibold">Webhooks</h1>
      <Card>
        <CardHeader>
          <CardTitle>Endpoints</CardTitle>
        </CardHeader>
        <CardContent>
          <WebhooksTable items={items} />
          <div className="mt-4 space-y-2">
            {items.map((w) => (
              <div key={w.id} className="flex items-center justify-between border rounded-md p-2">
                <span className="text-xs text-muted-foreground truncate">{w.targetUrl}</span>
                <div className="space-x-2">
                  <form action={test} className="inline-block">
                    <input type="hidden" name="id" value={w.id} />
                    <Button size="sm" type="submit">Test</Button>
                  </form>
                  <form action={deactivate} className="inline-block">
                    <input type="hidden" name="id" value={w.id} />
                    <Button variant="destructive" size="sm" type="submit">{w.active ? 'Deactivate' : 'Delete'}</Button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter>
          <form action={create} className="w-full grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]">
            <Input name="url" placeholder="https://example.com/webhooks" />
            <Input name="events" placeholder="Comma-separated events e.g. config.updated, snapshot.restored" />
            <Input name="secret" placeholder="Signing secret" />
            <Button type="submit">Create</Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
