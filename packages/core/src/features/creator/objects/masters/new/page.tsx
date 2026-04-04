import { redirect } from "next/navigation";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { getOptionalSession } from "@/server/auth/session";
import { fetchInternalApi } from "@/server/services/internal-api";

async function createObject(formData: FormData) {
  'use server';
  const name = String(formData.get('name') || '');
  const description = String(formData.get('description') || '');
  await fetchInternalApi('/api/creator/master-objects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description }),
  });
  return redirect('/dashboard/database/objects');
}

export default async function NewObjectPage() {
  const session = await getOptionalSession();
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
