import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { webhooks } from "@/schemas/sl-schema";
import { eq } from "drizzle-orm";
import { getCreatorContextFromApiKey, requireScope } from "@/features/creator/api/auth";
import { deliverWebhook, deliverToDestinations } from "@/features/creator/webhooks/server/delivery";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const authCtx = await getCreatorContextFromApiKey(req as any);
    requireScope(authCtx, "sl.webhooks:write");

    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const event = String(body?.event || "test.ping");
    const payload = body?.payload ?? { hello: "world" };

    const rows = await db.select().from(webhooks).where(eq(webhooks.id, id)).limit(1);
    if (!rows.length) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const wh = rows[0];

    // Scope check
    const scopeOk =
      (wh.scopeType === "org" && wh.scopeId === (authCtx.targets?.orgId as any)) ||
      (wh.scopeType === "team" && wh.scopeId === (authCtx.targets?.teamId as any)) ||
      (wh.scopeType === "user" && wh.scopeId === (authCtx.userId as any));
    if (!scopeOk) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const httpRes = await deliverWebhook({ url: wh.targetUrl, event, payload, secret: wh.secret as any, webhookId: id });
    const destRes = await deliverToDestinations({ webhookId: id, event, payload });

    return NextResponse.json({ http: httpRes, destinations: destRes }, { status: 200 });
  } catch (e: any) {
    if (e.message?.includes("missing_bearer")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (e.message?.includes("forbidden")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });



  }
}
