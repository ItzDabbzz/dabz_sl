import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

async function createObject(formData: FormData) {
  'use server';
  const hdrs = await headers();
  const base = process.env.NEXT_PUBLIC_APP_URL || hdrs.get('x-url') || '';
  const name = String(formData.get('name') || '');
  const description = String(formData.get('description') || '');
  // Forward only cookie so the API authenticates via first-party session
  const outHeaders = new Headers({ 'Content-Type': 'application/json' });
  const cookie = hdrs.get('cookie');
  if (cookie) outHeaders.set('cookie', cookie);
  await fetch(`${base}/api/creator/master-objects`, { method: 'POST', headers: outHeaders, body: JSON.stringify({ name, description }) });
  return redirect('/dashboard/database/objects');
}

export default async function NewObjectPage() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session) return redirect('/sign-in');

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-xl font-semibold">New Master Object</h1>
      <Card>
        <CardHeader>
          <CardTitle>Create Object</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createObject} className="grid gap-4">
            <div className="grid gap-2">
              <label className="text-sm">Name</label>
              <Input name="name" required />
            </div>
            <div className="grid gap-2">
              <label className="text-sm">Description</label>
              <Textarea name="description" rows={5} />
            </div>
            <Button type="submit">Create</Button>
          </form>
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground">Add schema/default config later.</CardFooter>
      </Card>
    </div>
  );
}
