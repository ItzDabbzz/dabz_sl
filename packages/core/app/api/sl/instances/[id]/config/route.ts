import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { objectInstances, userConfigs, auditLogs } from "@/schemas/sl-schema";
import { SlConfigResponse, SlConfigUpdateBody, SlConfigUpdateResponse } from "@/schemas/sl.zod";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { makeConfigHash, makeEtagFromHash, stableStringify } from "@/lib/utils";
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

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id;

    // Rate limit by instance and IP
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const rl = await rateLimit(`getcfg:${id}:${ip}`, 30, 60_000);
    if (!rl.ok)
      return new NextResponse(null, {
        status: 429,
        headers: rlHeaders(rl),
      });

    const [inst] = await db.select().from(objectInstances).where(eq(objectInstances.id, id));
    if (!inst) return NextResponse.json({ error: "instance_not_found" }, { status: 404, headers: rlHeaders(rl) });

    const [active] = inst.activeConfigId
      ? await db.select().from(userConfigs).where(eq(userConfigs.id, inst.activeConfigId))
      : [];

    const config = active?.configJson ?? {};
    const current = inst.currentConfigHash ?? makeConfigHash(config);
    const etag = makeEtagFromHash(current);

    // ETag handling
    const inm = req.headers.get("if-none-match");
    if (inm && inm === etag) return new NextResponse(null, { status: 304, headers: { ETag: etag, ...rlHeaders(rl) } });

    const resBody: z.infer<typeof SlConfigResponse> = {
      instanceId: id,
      config,
      etag,
      version: inst.version ?? 1,
      updatedAt: inst.updatedAt?.toISOString?.() ?? new Date().toISOString(),
    };

    return NextResponse.json(resBody, { status: 200, headers: { ETag: etag, ...rlHeaders(rl) } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const rawBody = await req.text();
  try {
    const headers = Object.fromEntries(req.headers);

    // Rate limit by instance and IP (before verification to shield)
    const ip = headers["x-forwarded-for"] || "unknown";
    const id = params.id;
    const rl = await rateLimit(`setcfg:${id}:${ip}`, 20, 60_000);
    if (!rl.ok)
      return new NextResponse(null, {
        status: 429,
        headers: rlHeaders(rl),
      });

    const { instanceId } = await verifyInstanceSignature({ headers, rawBody });
    if (instanceId !== id) return NextResponse.json({ error: "instance_mismatch" }, { status: 403, headers: rlHeaders(rl) });

    const signature = headers["x-signature"] as string | undefined;
    if (!signature) return NextResponse.json({ error: "missing_signature" }, { status: 401, headers: rlHeaders(rl) });
    if (!(await checkReplay(instanceId, signature, 60_000)))
      return NextResponse.json({ error: "replay_detected" }, { status: 409, headers: rlHeaders(rl) });

    const parsed = SlConfigUpdateBody.parse(JSON.parse(rawBody));

    const [inst] = await db.select().from(objectInstances).where(eq(objectInstances.id, instanceId));
    if (!inst) return NextResponse.json({ error: "instance_not_found" }, { status: 404, headers: rlHeaders(rl) });

    const [cfg] = await db
      .insert(userConfigs)
      .values({ instanceId, configJson: parsed.config, versionTag: parsed.versionTag })
      .returning({ id: userConfigs.id });

    const hash = makeConfigHash(parsed.config);
    const etag = makeEtagFromHash(hash);

    await db
      .update(objectInstances)
      .set({ activeConfigId: cfg.id, currentConfigHash: hash })
      .where(eq(objectInstances.id, instanceId));

    // Audit log
    await db.insert(auditLogs).values({
      actorType: "instance",
      actorId: instanceId as any,
      scopeType: inst.orgId ? "org" : inst.teamId ? "team" : "user",
      scopeId: (inst.orgId || inst.teamId || inst.ownerUserId || null) as any,
      eventType: "config.updated",
      metadata: { instanceId, configId: cfg.id, versionTag: parsed.versionTag, etag },
    });

    const res: z.infer<typeof SlConfigUpdateResponse> = { success: true, activeConfigId: cfg.id, etag };
    return NextResponse.json(res, { status: 200, headers: { ETag: etag, ...rlHeaders(rl) } });
  } catch (e: any) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "invalid_body", details: e.issues }, { status: 400 });
    if (e?.message?.startsWith?.("missing_") || e?.message?.includes?.("signature"))
      return NextResponse.json({ error: e.message }, { status: 401 });
    if (e?.message === "timestamp_skew") return NextResponse.json({ error: e.message }, { status: 401 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
