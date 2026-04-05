export const revalidate = 120;

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { sql } from "drizzle-orm";

function isMissingColumnError(error: unknown) {
  const candidate = error as { code?: string; cause?: { code?: string } };
  return candidate?.code === "42703" || candidate?.cause?.code === "42703";
}

// Returns distinct creators (authors) from marketplace items.
// Each author entry: { name, link, itemCount }
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim().toLowerCase();
    const showNsfw = searchParams.get("showNsfw") === "true";
    const limit = Math.max(1, Math.min(500, parseInt(searchParams.get("limit") || "100", 10)));

    // Use parameterized SQL for safety; filter name via lower(name) LIKE pattern if q provided.
    const pattern = q ? `%${q}%` : undefined;
    let rows: Array<{ name: string | null; link: string | null; itemCount: number }> = [];

    try {
      rows = ((await db.execute(sql`
        select
          nullif(trim(creator->>'name'), '') as name,
          nullif(trim(creator->>'link'), '') as link,
          count(*)::int as "itemCount"
        from sl_mp_items
        where creator is not null
          ${showNsfw ? sql`` : sql`and coalesce(is_nsfw, false) = false`}
          ${q ? sql`and lower(creator->>'name') like ${pattern}` : sql``}
        group by 1,2
        having nullif(trim(creator->>'name'), '') is not null
        order by 3 desc, 1 asc
        limit ${limit}
      `) as any).rows || []) as typeof rows;
    } catch (error) {
      if (!isMissingColumnError(error)) throw error;

      rows = ((await db.execute(sql`
        select
          nullif(trim(creator->>'name'), '') as name,
          nullif(trim(creator->>'link'), '') as link,
          count(*)::int as "itemCount"
        from sl_mp_items
        where creator is not null
          ${q ? sql`and lower(creator->>'name') like ${pattern}` : sql``}
        group by 1,2
        having nullif(trim(creator->>'name'), '') is not null
        order by 3 desc, 1 asc
        limit ${limit}
      `) as any).rows || []) as typeof rows;
    }

    const items = rows
      .filter(r => r.name)
      .map(r => ({ name: r.name!, link: r.link || null, itemCount: r.itemCount || 0 }));

    return NextResponse.json({ items, total: items.length, limit });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
