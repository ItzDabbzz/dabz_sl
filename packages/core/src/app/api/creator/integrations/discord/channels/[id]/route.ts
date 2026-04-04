export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { discordChannels } from "@/schemas/sl-schema";
import { eq } from "drizzle-orm";
import { getCreatorContextFromApiKey, requireScope } from "@/features/creator/api/auth";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getCreatorContextFromApiKey(req as any);
    requireScope(ctx, "sl.webhooks:write");
  const { id } = await context.params;
    const { name, webhookUrl } = await req.json();
    const data: any = {};
    if (typeof name === "string") data.name = name;
    if (typeof webhookUrl === "string") data.webhookUrl = webhookUrl;
    if (Object.keys(data).length === 0) return NextResponse.json({ error: "no_changes" }, { status: 400 });
    await db.update(discordChannels).set(data).where(eq(discordChannels.id, id as any));
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
    await db.delete(discordChannels).where(eq(discordChannels.id, id as any));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.message?.includes("missing_bearer")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (e?.message?.includes("forbidden")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });


  }
}
