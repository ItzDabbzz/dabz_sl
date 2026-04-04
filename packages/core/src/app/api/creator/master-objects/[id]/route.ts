export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { masterObjects } from "@/schemas/sl-schema";
import { and, eq } from "drizzle-orm";
import { getCreatorContextFromApiKey, requireScope } from "@/features/creator/api/auth";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const ctxAuth = await getCreatorContextFromApiKey(_req as any);
    requireScope(ctxAuth, "sl.objects:read");

    const rows = await db
      .select()
      .from(masterObjects)
      .where(
        and(
          eq(masterObjects.id, id),
          ctxAuth.targets?.orgId
            ? eq(masterObjects.orgId, ctxAuth.targets.orgId as any)
            : ctxAuth.targets?.teamId
            ? eq(masterObjects.teamId, ctxAuth.targets.teamId as any)
            : eq(masterObjects.ownerUserId, ctxAuth.userId as any)
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

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const ctxAuth = await getCreatorContextFromApiKey(req as any);
    requireScope(ctxAuth, "sl.objects:write");

    const body = await req.json();
    const { name, description, defaultConfigJson, configSchemaJson, visibility, currentVersion } = body || {};

    const res = await db
      .update(masterObjects)
      .set({
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(defaultConfigJson !== undefined ? { defaultConfigJson } : {}),
        ...(configSchemaJson !== undefined ? { configSchemaJson } : {}),
        ...(visibility !== undefined ? { visibility } : {}),
        ...(currentVersion !== undefined ? { currentVersion } : {}),
      })
      .where(
        and(
          eq(masterObjects.id, id),
          ctxAuth.targets?.orgId
            ? eq(masterObjects.orgId, ctxAuth.targets.orgId as any)
            : ctxAuth.targets?.teamId
            ? eq(masterObjects.teamId, ctxAuth.targets.teamId as any)
            : eq(masterObjects.ownerUserId, ctxAuth.userId as any)
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

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const ctxAuth = await getCreatorContextFromApiKey(req as any);
    requireScope(ctxAuth, "sl.objects:write");

    const res = await db
      .delete(masterObjects)
      .where(
        and(
          eq(masterObjects.id, id),
          ctxAuth.targets?.orgId
            ? eq(masterObjects.orgId, ctxAuth.targets.orgId as any)
            : ctxAuth.targets?.teamId
            ? eq(masterObjects.teamId, ctxAuth.targets.teamId as any)
            : eq(masterObjects.ownerUserId, ctxAuth.userId as any)
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
