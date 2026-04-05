import { redirect } from "next/navigation";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiKeysTable, type ApiKeyItem } from "./components/table";
import WorkInProgressNotice from "@/components/shared/work-in-progress-notice";
import { ActionsClient } from "./actions-client";
import { fetchInternalApiJson } from "@/server/services/internal-api";
import { getOptionalSession } from "@/server/auth/session";

export default async function ApiKeysPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getOptionalSession();
  if (!session) return redirect("/sign-in");

  const sp = (await searchParams) || {};
  const q = typeof sp.q === "string" ? sp.q : "";
  const limit = Number(typeof sp.limit === "string" ? sp.limit : 20) || 20;
  const offset = Number(typeof sp.offset === "string" ? sp.offset : 0) || 0;
  const sortKey = (typeof sp.sortKey === "string" ? sp.sortKey : "createdAt") as "name" | "createdAt" | "lastUsedAt";
  const sortDir = (typeof sp.sortDir === "string" ? sp.sortDir : "desc") as "asc" | "desc";

  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  qs.set("limit", String(limit));
  qs.set("offset", String(offset));
  qs.set("sortKey", sortKey);
  qs.set("sortDir", sortDir);

  const json = await fetchInternalApiJson(
    `/api/creator/apikeys?${qs.toString()}`,
    { items: [], page: { limit, offset, hasMore: false, total: 0 } },
    { cache: "no-store" },
  );
  const list = Array.isArray(json?.items) ? json.items : [];
  const items: ApiKeyItem[] = list.map((x: any) => ({
    id: x.id,
    name: x.name,
    createdAt: x.createdAt,
    lastUsedAt: x.lastUsedAt ?? x.lastRequest ?? null,
    permissions: x.metadata?.permissions ?? x.permissions ?? null,
    enabled: x.enabled,
    expiresAt: x.expiresAt,
    rateLimitEnabled: x.rateLimitEnabled,
    rateLimitTimeWindow: x.rateLimitTimeWindow,
    rateLimitMax: x.rateLimitMax,
  }));

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
          {/* Table with server pagination/filter/sort wiring */}
          <ApiKeysTable
            items={items}
            page={json?.page}
            q={q}
            sortKey={sortKey}
            sortDir={sortDir}
          />
          <div className="my-4 h-px w-full bg-border" />
          {/* Actions per key */}
          <ActionsClient />
        </CardContent>
        <CardFooter>
          {/* Duplicated in ActionsClient */}
        </CardFooter>
      </Card>
    </div>
  );
}
