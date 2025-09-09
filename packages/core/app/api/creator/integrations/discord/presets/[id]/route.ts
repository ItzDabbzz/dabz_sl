import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { discordEmbedPresets } from "@/schemas/sl-schema";
import { eq } from "drizzle-orm";
import { getCreatorContextFromApiKey, requireScope } from "@/lib/creator-auth";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getCreatorContextFromApiKey(req as any);
    requireScope(ctx, "sl.webhooks:write");
  const { id } = await context.params;
    const { name, payload } = await req.json();
    const data: any = {};
    if (typeof name === "string") data.name = name;
    if (payload !== undefined) data.payloadJson = payload;
    if (Object.keys(data).length === 0) return NextResponse.json({ error: "no_changes" }, { status: 400 });
    await db.update(discordEmbedPresets).set(data).where(eq(discordEmbedPresets.id, id as any));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.message?.includes("missing_bearer")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (e?.message?.includes("forbidden")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getCreatorContextFromApiKey(req as any);
    requireScope(ctx, "sl.webhooks:write");
  const { id } = await context.params;
    await db.delete(discordEmbedPresets).where(eq(discordEmbedPresets.id, id as any));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.message?.includes("missing_bearer")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (e?.message?.includes("forbidden")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
