import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { objectVersions } from "@/schemas/sl-schema";
import { and, eq } from "drizzle-orm";
import { getCreatorContextFromApiKey, requireScope } from "@/lib/creator-auth";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getCreatorContextFromApiKey(req as any);
    requireScope(ctx, "sl.objects:read");

    const rows = await db.select().from(objectVersions).where(eq(objectVersions.masterObjectId, params.id));
    return NextResponse.json({ items: rows }, { status: 200 });
  } catch (e: any) {
    if (e.message?.includes("missing_bearer")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (e.message?.includes("forbidden")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getCreatorContextFromApiKey(req as any);
    requireScope(ctx, "sl.objects:write");

    const body = await req.json();
    const { version, changelog, migrationRef } = body || {};

    const inserted = await db
      .insert(objectVersions)
      .values({ masterObjectId: params.id, version, changelog, migrationRef })
      .returning({ id: objectVersions.id });

    return NextResponse.json({ id: inserted[0].id }, { status: 201 });
  } catch (e: any) {
    if (e.message?.includes("missing_bearer")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (e.message?.includes("forbidden")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
