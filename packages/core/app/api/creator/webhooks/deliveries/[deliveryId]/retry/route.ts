import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { webhookDeliveries, webhooks } from "@/schemas/sl-schema";
import { eq } from "drizzle-orm";
import { getCreatorContextFromApiKey, requireScope } from "@/lib/creator-auth";

async function deliver({ url, event, payload, secret }: { url: string; event: string; payload: any; secret?: string }) {
  // Lightweight inline deliver to avoid adding new lib here.
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(secret ? { "x-webhook-signature": secret } : {}),
      },
      body: JSON.stringify({ event, data: payload }),
    });
    const text = await res.text();
    return { status: res.status, body: text, durationMs: Date.now() - start };
  } catch (err: any) {
    return { status: undefined, body: undefined, error: err?.message || String(err), durationMs: Date.now() - start };
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ deliveryId: string }> }) {
  try {
    const ctx = await getCreatorContextFromApiKey(req as any);
    requireScope(ctx, "sl.webhooks:write");

    const { deliveryId } = await params;

    const delivery = await db.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, deliveryId)).limit(1);
    if (!delivery.length) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const d = delivery[0];

    // If linked to a webhook, ensure scope access
    if (d.webhookId) {
      const whRows = await db.select().from(webhooks).where(eq(webhooks.id, d.webhookId)).limit(1);
      if (!whRows.length) return NextResponse.json({ error: "not_found" }, { status: 404 });
      const wh = whRows[0];
      const scopeOk =
        (wh.scopeType === "org" && wh.scopeId === (ctx.targets?.orgId as any)) ||
        (wh.scopeType === "team" && wh.scopeId === (ctx.targets?.teamId as any)) ||
        (wh.scopeType === "user" && wh.scopeId === (ctx.userId as any));
      if (!scopeOk) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const request = d.requestJson as any;
    const res = await deliver({ url: d.targetUrl as any, event: d.event as any, payload: request?.data, secret: d.signature as any });

    return NextResponse.json({ ok: true, result: res }, { status: 200 });
  } catch (e: any) {
    if (e.message?.includes("missing_bearer")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (e.message?.includes("forbidden")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
