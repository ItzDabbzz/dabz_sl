export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { objectInstances, auditLogs } from "@/schemas/sl-schema";
import { eq } from "drizzle-orm";
import { getCreatorContextFromApiKey, requireScope } from "@/lib/creator-auth";
import { generateToken, hashToken } from "@/lib/utils";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getCreatorContextFromApiKey(req as any);
    requireScope(ctx, "sl.instances:write");

  const { id } = await params;
    const [inst] = await db.select().from(objectInstances).where(eq(objectInstances.id, id));
    if (!inst) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const token = generateToken(32);
    const tokenHash = hashToken(token);
    const now = new Date();
    const expires = new Date(now.getTime() + 1000 * 60 * 15);

    await db
      .update(objectInstances)
      .set({ instanceTokenHash: tokenHash, tokenExpiresAt: expires })
      .where(eq(objectInstances.id, id));

    await db.insert(auditLogs).values({
      actorType: "apiKey",
      actorId: ctx.userId as any,
      scopeType: ctx.targets?.orgId ? "org" : ctx.targets?.teamId ? "team" : "user",
      scopeId: (ctx.targets?.orgId || ctx.targets?.teamId || (ctx.userId as any)) as any,
      eventType: "instance.token.rotated",
      metadata: { instanceId: id },
    });

    return NextResponse.json({ token, tokenExpiresAt: expires.toISOString() }, { status: 200 });
  } catch (e: any) {
    if (e.message?.includes("missing_bearer")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (e.message?.includes("forbidden")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });



  }
}
