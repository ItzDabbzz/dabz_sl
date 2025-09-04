import RequestsClient from "./ui";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function getSession() {
  try {
    return await auth.api.getSession({ headers: await headers() });
  } catch {
    return null;
  }
}

export default async function Page() {
  const session = await getSession();
  const role = (session?.user as any)?.adminRole as string | undefined;
  const can = !!role && ["owner", "developer", "admin", "mod"].includes(role);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Marketplace Requests</h1>
        <p className="text-sm text-muted-foreground">Review public submissions and approve to add them to your items.</p>
      </div>
      {!can ? (
        <div className="rounded border p-4 text-sm text-muted-foreground">You do not have permission to view this page.</div>
      ) : (
        <RequestsClient />
      )}
    </div>
  );
}
