import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { objectInstances, userConfigs, configSnapshots, auditLogs } from "@/schemas/sl-schema";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { verifyInstanceSignature } from "@/lib/sl-auth";
import { rateLimit, checkReplay } from "@/lib/rate-limit";

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

export async function POST(req: NextRequest, { params }: { params: { id: string; snapshotId: string } }) {
  const rawBody = await req.text();
  try {
    const headers = Object.fromEntries(req.headers);

    // Rate limit by instance and IP
    const ip = headers["x-forwarded-for"] || "unknown";
    const { id, snapshotId } = params;
    const rl = await rateLimit(`restore:${id}:${ip}`, 10, 60_000);
    if (!rl.ok) return new NextResponse(null, { status: 429, headers: rlHeaders(rl) });

    const { instanceId } = await verifyInstanceSignature({ headers, rawBody });
    if (instanceId !== id) return NextResponse.json({ error: "instance_mismatch" }, { status: 403, headers: rlHeaders(rl) });

    const signature = headers["x-signature"] as string | undefined;
    if (!signature) return NextResponse.json({ error: "missing_signature" }, { status: 401, headers: rlHeaders(rl) });
    if (!(await checkReplay(instanceId, signature, 60_000))) return NextResponse.json({ error: "replay_detected" }, { status: 409, headers: rlHeaders(rl) });

    const [inst] = await db.select().from(objectInstances).where(eq(objectInstances.id, id));
    if (!inst) return NextResponse.json({ error: "instance_not_found" }, { status: 404, headers: rlHeaders(rl) });

    const [snap] = await db
      .select()
      .from(configSnapshots)
      .where(and(eq(configSnapshots.id, snapshotId), eq(configSnapshots.instanceId, id)));
    if (!snap) return NextResponse.json({ error: "snapshot_not_found" }, { status: 404, headers: rlHeaders(rl) });

    const [cfg] = await db
      .select()
      .from(userConfigs)
      .where(and(eq(userConfigs.id, snap.sourceConfigId), eq(userConfigs.instanceId, id)));
    if (!cfg) return NextResponse.json({ error: "config_not_found" }, { status: 404, headers: rlHeaders(rl) });

    await db
      .update(objectInstances)
      .set({ activeConfigId: cfg.id })
      .where(eq(objectInstances.id, id));

    // Audit log
    await db.insert(auditLogs).values({
      actorType: "instance",
      actorId: instanceId as any,
      scopeType: inst.orgId ? "org" : inst.teamId ? "team" : "user",
      scopeId: (inst.orgId || inst.teamId || inst.ownerUserId || null) as any,
      eventType: "snapshot.restored",
      metadata: { instanceId, snapshotId, restoredConfigId: cfg.id },
    });

    return NextResponse.json({ ok: true }, { status: 200, headers: rlHeaders(rl) });
  } catch (e: any) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "invalid_body", details: e.issues }, { status: 400 });
    if (e?.message?.startsWith?.("missing_") || e?.message?.includes?.("signature"))
      return NextResponse.json({ error: e.message }, { status: 401 });
    if (e?.message === "timestamp_skew") return NextResponse.json({ error: e.message }, { status: 401 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
