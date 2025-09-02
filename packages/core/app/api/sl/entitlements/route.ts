import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { entitlements, auditLogs } from "@/schemas/sl-schema";
import { SlEntitlementBody, SlEntitlementResponse } from "@/schemas/sl.zod";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { rateLimit } from "@/lib/rate-limit";

function rlHeaders(rl: any) {
  if (!rl) return {} as Record<string, string>;
  const reset = rl.resetAt ? Math.floor(rl.resetAt / 1000) : undefined;
  const h: Record<string, string> = {};
  if (rl.limit != null) h["X-RateLimit-Limit"] = String(rl.limit);
  if (rl.remaining != null) h["X-RateLimit-Remaining"] = String(rl.remaining);
  if (reset != null) h["X-RateLimit-Reset"] = String(reset);
  if (!rl.ok && rl.retryAfterMs != null) h["Retry-After"] = String(Math.ceil(rl.retryAfterMs / 1000));
  return h;
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const rl = await rateLimit(`entitlements:${ip}`, 20, 60_000);
    if (!rl.ok) return new NextResponse(null, { status: 429, headers: rlHeaders(rl) });

    const body = await req.json();
    const parsed = SlEntitlementBody.parse(body);

    // Upsert entitlement (ownerUuid + masterObjectId)
    const [existing] = await db
      .select()
      .from(entitlements)
      .where(and(eq(entitlements.ownerSlUuid, parsed.ownerUuid), eq(entitlements.masterObjectId, parsed.masterObjectId)));

    let entId: string;
    let action: "created" | "updated" = "created";
    if (existing) {
      await db
        .update(entitlements)
        .set({ source: parsed.source, proofRef: parsed.proofRef })
        .where(eq(entitlements.id, existing.id));
      entId = existing.id as any;
      action = "updated";
    } else {
      const [row] = await db
        .insert(entitlements)
        .values({
          ownerSlUuid: parsed.ownerUuid,
          masterObjectId: parsed.masterObjectId,
          source: parsed.source,
          proofRef: parsed.proofRef,
        })
        .returning({ id: entitlements.id });
      entId = row.id as any;
    }

    // Audit log (actor is system since no instance/api key context here)
    await db.insert(auditLogs).values({
      actorType: "apiKey",
      actorId: null as any,
      scopeType: "user",
      scopeId: parsed.ownerUuid as any,
      eventType: `entitlement.${action}`,
      metadata: { entitlementId: entId, ownerUuid: parsed.ownerUuid, masterObjectId: parsed.masterObjectId, source: parsed.source },
    });

    const res: z.infer<typeof SlEntitlementResponse> = { ok: true };
    return NextResponse.json(res, { status: 200, headers: rlHeaders(rl) });
  } catch (e: any) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "invalid_body", details: e.issues }, { status: 400 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
