import RequestsClient from "./components/RequestsClient";
import { isPrivilegedMarketplaceRole } from "@/server/auth/roles";
import { getOptionalSession } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getOptionalSession();
  const role = (session?.user as any)?.role as string | undefined;
  const can = isPrivilegedMarketplaceRole(role);

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
