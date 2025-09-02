import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { masterObjects } from "@/schemas/sl-schema";
import { and, eq } from "drizzle-orm";
import { getCreatorContextFromApiKey, requireScope } from "@/lib/creator-auth";

export async function GET(req: NextRequest) {
  try {
    const ctx = await getCreatorContextFromApiKey(req as any);
    requireScope(ctx, "sl.objects:read");

    const cond = ctx.targets?.orgId
      ? eq(masterObjects.orgId, ctx.targets.orgId as any)
      : ctx.targets?.teamId
      ? eq(masterObjects.teamId, ctx.targets.teamId as any)
      : eq(masterObjects.ownerUserId, ctx.userId as any);

    const list = await db.select().from(masterObjects).where(cond);
    return NextResponse.json({ items: list }, { status: 200 });
  } catch (e: any) {
    if (e.message?.includes("missing_bearer")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (e.message?.includes("forbidden")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getCreatorContextFromApiKey(req as any);
    requireScope(ctx, "sl.objects:write");

    const { name, description, defaultConfigJson, configSchemaJson, visibility } = await req.json();

    const inserted = await db
      .insert(masterObjects)
      .values({
        name,
        description,
        defaultConfigJson,
        configSchemaJson,
        visibility: visibility ?? "private",
        ownerUserId: ctx.targets?.orgId || ctx.targets?.teamId ? undefined : (ctx.userId as any),
        orgId: (ctx.targets?.orgId as any) ?? null,
        teamId: (ctx.targets?.teamId as any) ?? null,
      })
      .returning({ id: masterObjects.id });

    return NextResponse.json({ id: inserted[0].id }, { status: 201 });
  } catch (e: any) {
    if (e.message?.includes("missing_bearer")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (e.message?.includes("forbidden")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
