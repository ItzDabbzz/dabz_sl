import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { masterObjects } from "@/schemas/sl-schema";
import { and, eq } from "drizzle-orm";
import { getCreatorContextFromApiKey, requireScope } from "@/lib/creator-auth";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getCreatorContextFromApiKey(_req as any);
    requireScope(ctx, "sl.objects:read");

    const rows = await db
      .select()
      .from(masterObjects)
      .where(
        and(
          eq(masterObjects.id, params.id),
          ctx.targets?.orgId
            ? eq(masterObjects.orgId, ctx.targets.orgId as any)
            : ctx.targets?.teamId
            ? eq(masterObjects.teamId, ctx.targets.teamId as any)
            : eq(masterObjects.ownerUserId, ctx.userId as any)
        )
      );
    const row = rows[0];
    if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(row, { status: 200 });
  } catch (e: any) {
    if (e.message?.includes("missing_bearer")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (e.message?.includes("forbidden")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getCreatorContextFromApiKey(req as any);
    requireScope(ctx, "sl.objects:write");

    const body = await req.json();
    const { name, description, defaultConfigJson, configSchemaJson, visibility } = body || {};

    const res = await db
      .update(masterObjects)
      .set({
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(defaultConfigJson !== undefined ? { defaultConfigJson } : {}),
        ...(configSchemaJson !== undefined ? { configSchemaJson } : {}),
        ...(visibility !== undefined ? { visibility } : {}),
      })
      .where(
        and(
          eq(masterObjects.id, params.id),
          ctx.targets?.orgId
            ? eq(masterObjects.orgId, ctx.targets.orgId as any)
            : ctx.targets?.teamId
            ? eq(masterObjects.teamId, ctx.targets.teamId as any)
            : eq(masterObjects.ownerUserId, ctx.userId as any)
        )
      )
      .returning({ id: masterObjects.id });

    if (!res.length) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ id: res[0].id }, { status: 200 });
  } catch (e: any) {
    if (e.message?.includes("missing_bearer")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (e.message?.includes("forbidden")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getCreatorContextFromApiKey(req as any);
    requireScope(ctx, "sl.objects:write");

    const res = await db
      .delete(masterObjects)
      .where(
        and(
          eq(masterObjects.id, params.id),
          ctx.targets?.orgId
            ? eq(masterObjects.orgId, ctx.targets.orgId as any)
            : ctx.targets?.teamId
            ? eq(masterObjects.teamId, ctx.targets.teamId as any)
            : eq(masterObjects.ownerUserId, ctx.userId as any)
        )
      )
      .returning({ id: masterObjects.id });
    if (!res.length) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ id: res[0].id }, { status: 200 });
  } catch (e: any) {
    if (e.message?.includes("missing_bearer")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (e.message?.includes("forbidden")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
