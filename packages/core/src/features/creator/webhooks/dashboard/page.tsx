import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { randomBytes } from "node:crypto";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { WebhooksTable, type WebhookItem } from "./components/table";
import { absoluteUrl } from "@/lib/absolute-url";
import { CreateWebhookDialog } from "./components/create-dialog";
import { VerificationDocsDrawer } from "./components/verification-drawer";
import { DiscordEmbedDialog } from "./components/discord-embed-dialog";

export default async function WebhooksPage() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session) return redirect("/sign-in");

  const hdrs = await headers();
  const base = absoluteUrl(hdrs);
  const res = await fetch(`${base}/api/creator/webhooks`, { headers: { Authorization: hdrs.get("authorization") || "" } });
  const data = await res.json().catch(() => ({ items: [] }));
  const items: WebhookItem[] = (data?.items || []).map((x: any) => ({ id: x.id, targetUrl: x.targetUrl, active: x.active, events: x.events || [], secretLast4: typeof x.secret === 'string' ? x.secret.slice(-4) : undefined }));

  async function toggleActive(formData: FormData) {
    'use server';
    const id = String(formData.get('id') || '');
    const active = String(formData.get('active') || '') === 'true';
    const hdrs2 = await headers();
    const base2 = absoluteUrl(hdrs2);
    await fetch(`${base2}/api/creator/webhooks/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: hdrs2.get('authorization') || '' }, body: JSON.stringify({ active }) });
    revalidatePath('/dashboard/webhooks');
  }

  async function create(formData: FormData) {
    'use server';
    const url = String(formData.get('url') || '');
    const events = String(formData.get('events') || '').split(/\s*,\s*/).filter(Boolean);
    const secret = String(formData.get('secret') || '');
    const hdrs2 = await headers();
    const base2 = absoluteUrl(hdrs2);
    await fetch(`${base2}/api/creator/webhooks`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: hdrs2.get('authorization') || '' }, body: JSON.stringify({ targetUrl: url, events, secret }) });
    revalidatePath('/dashboard/webhooks');
  }

  async function test(formData: FormData) {
    'use server';
    const id = String(formData.get('id') || '');
    const hdrs2 = await headers();
    const base2 = absoluteUrl(hdrs2);
  await fetch(`${base2}/api/creator/webhooks/${encodeURIComponent(id)}/test`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: hdrs2.get('authorization') || '' }, body: JSON.stringify({ event: 'test.ping', payload: { hello: 'world' } }) });
    revalidatePath('/dashboard/webhooks');
  }

  async function bulk(formData: FormData) {
    'use server';
    const op = String(formData.get('op') || '');
    const idsCsv = String(formData.get('ids') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const hdrs2 = await headers();
    const base2 = absoluteUrl(hdrs2);
    // Fetch endpoints once when needed
    const list = op === 'test'
      ? await fetch(`${base2}/api/creator/webhooks`, { headers: { Authorization: hdrs2.get('authorization') || '' } }).then(r => r.json()).catch(() => ({ items: [] }))
      : null;
    // Execute sequentially to avoid API rate limits; adjust to parallel if backend supports it
    for (const id of idsCsv) {
      if (op === 'test') {
        const row = Array.isArray(list?.items) ? list.items.find((x: any) => x.id === id) : null;
        if (row?.targetUrl) {
          await fetch(`${base2}/api/creator/webhooks/test`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: hdrs2.get('authorization') || '' }, body: JSON.stringify({ url: row.targetUrl, event: 'test.ping', payload: { hello: 'world' }, secret: row.secret }) });
        }
      } else if (op === 'enable' || op === 'disable') {
        await fetch(`${base2}/api/creator/webhooks/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: hdrs2.get('authorization') || '' }, body: JSON.stringify({ active: op === 'enable' }) });
      }
    }
    revalidatePath('/dashboard/webhooks');
  }

  async function rotateSecret(formData: FormData) {
    'use server';
    const id = String(formData.get('id') || '');
    const newSecret = randomBytes(24).toString('hex');
    const hdrs2 = await headers();
    const base2 = absoluteUrl(hdrs2);
    await fetch(`${base2}/api/creator/webhooks/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: hdrs2.get('authorization') || '' }, body: JSON.stringify({ secret: newSecret }) });
    revalidatePath('/dashboard/webhooks');
  }

  async function loadLogs(formData: FormData) {
    'use server';
    const id = String(formData.get('id') || '');
  const page = Number(formData.get('page') || 1);
  const pageSize = Number(formData.get('pageSize') || 10);
  const q = String(formData.get('q') || '');
  const status = String(formData.get('status') || 'all');
    const hdrs2 = await headers();
    const base2 = absoluteUrl(hdrs2);
  const usp = new URLSearchParams();
  usp.set('page', String(page));
  usp.set('pageSize', String(pageSize));
  if (q) usp.set('q', q);
  if (status) usp.set('status', status);
  const res = await fetch(`${base2}/api/creator/webhooks/${encodeURIComponent(id)}/deliveries?${usp.toString()}`, { headers: { Authorization: hdrs2.get('authorization') || '' } });
    const data = await res.json().catch(() => ({ items: [] }));
    return data;
  }

  async function retryDelivery(formData: FormData) {
    'use server';
    const deliveryId = String(formData.get('deliveryId') || '');
    const hdrs2 = await headers();
    const base2 = absoluteUrl(hdrs2);
    await fetch(`${base2}/api/creator/webhooks/deliveries/${encodeURIComponent(deliveryId)}/retry`, { method: 'POST', headers: { Authorization: hdrs2.get('authorization') || '' } });
    revalidatePath('/dashboard/webhooks');
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Webhooks</h1>
          <p className="text-sm text-muted-foreground">Manage outbound event deliveries and endpoints.</p>
        </div>
        <div className="flex items-center gap-2">
          <VerificationDocsDrawer />
          <DiscordEmbedDialog />
          <CreateWebhookDialog onCreate={create} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Endpoints</CardTitle>
        </CardHeader>
        <CardContent>
          <WebhooksTable items={items} onTest={test} onToggleActive={toggleActive} onBulk={bulk} onRotateSecret={rotateSecret} onLoadLogs={loadLogs} onRetryDelivery={retryDelivery} />
        </CardContent>
        <CardFooter>
          <div className="text-xs text-muted-foreground">
            Tip: Use the Test action to validate your integration before going live.
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
