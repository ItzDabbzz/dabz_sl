import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

async function saveObject(formData: FormData) {
  'use server';
  const hdrs = await headers();
  const base = process.env.NEXT_PUBLIC_APP_URL || hdrs.get('x-url') || '';
  const id = String(formData.get('id') || '');
  const name = String(formData.get('name') || '');
  const description = String(formData.get('description') || '');
  await fetch(`${base}/api/creator/master-objects/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: hdrs.get('authorization') || '' }, body: JSON.stringify({ name, description }) });
}

export default async function EditObjectPage({ params }: { params: { id: string } }) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session) return redirect('/sign-in');

  const hdrs = await headers();
  const base = process.env.NEXT_PUBLIC_APP_URL || hdrs.get('x-url') || '';
  const res = await fetch(`${base}/api/creator/master-objects/${encodeURIComponent(params.id)}`, { headers: { Authorization: hdrs.get('authorization') || '' } });
  const obj = await res.json().catch(() => null);
  if (!obj || obj.error) return redirect('/dashboard/objects');

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-xl font-semibold">Edit Master Object</h1>
      <Card>
        <CardHeader>
          <CardTitle>Edit Object</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveObject} className="grid gap-4">
            <input type="hidden" name="id" value={params.id} />
            <div className="grid gap-2">
              <label className="text-sm">Name</label>
              <Input name="name" defaultValue={obj.name} required />
            </div>
            <div className="grid gap-2">
              <label className="text-sm">Description</label>
              <Textarea name="description" rows={5} defaultValue={obj.description || ''} />
            </div>
            <Button type="submit">Save</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
