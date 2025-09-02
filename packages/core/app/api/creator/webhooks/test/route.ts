import { NextRequest, NextResponse } from "next/server";
import { getCreatorContextFromApiKey, requireScope } from "@/lib/creator-auth";
import { deliverWebhook } from "@/lib/webhooks";

export async function POST(req: NextRequest) {
  try {
    const ctx = await getCreatorContextFromApiKey(req as any);
    requireScope(ctx, "sl.webhooks:write");

    const { url, event = "test.event", payload = { ok: true }, secret } = await req.json();
    if (!url) return NextResponse.json({ error: "missing_url" }, { status: 400 });

    const result = await deliverWebhook({ url, event, payload, secret });
    return NextResponse.json(result, { status: 200 });
  } catch (e: any) {
    if (e.message?.includes("missing_bearer")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (e.message?.includes("forbidden")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
