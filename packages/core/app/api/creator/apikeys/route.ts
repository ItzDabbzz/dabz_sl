import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCreatorContextFromApiKey, requireScope } from "@/lib/creator-auth";

export async function GET(req: NextRequest) {
  try {
    const ctx = await getCreatorContextFromApiKey(req as any);
    requireScope(ctx, "sl.apikeys:read");

    const result = await auth.api.listApiKeys({ headers: { Authorization: req.headers.get("authorization")! } as any });
    return NextResponse.json({ items: result?.apiKeys ?? [] }, { status: 200 });
  } catch (e: any) {
    if (e.message?.includes("missing_bearer")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (e.message?.includes("forbidden")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getCreatorContextFromApiKey(req as any);
    requireScope(ctx, "sl.apikeys:write");

    const body = await req.json();
    const { name, scopes, metadata } = body || {};

    const created = await auth.api.createApiKey({
      body: { name, metadata: { ...(metadata || {}), permissions: (scopes || []).join(" ") } },
      headers: { Authorization: req.headers.get("authorization")! } as any,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    if (e.message?.includes("missing_bearer")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (e.message?.includes("forbidden")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const ctx = await getCreatorContextFromApiKey(req as any);
    requireScope(ctx, "sl.apikeys:write");

    const keyId = req.nextUrl.searchParams.get("id");
    if (!keyId) return NextResponse.json({ error: "missing_id" }, { status: 400 });

    await auth.api.deleteApiKey({
      body: { id: keyId },
      headers: { Authorization: req.headers.get("authorization")! } as any,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    if (e.message?.includes("missing_bearer")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (e.message?.includes("forbidden")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
