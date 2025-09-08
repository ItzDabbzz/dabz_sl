import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCreatorContextFromApiKey, requireScope } from "@/lib/creator-auth";

export async function GET(req: NextRequest) {
  try {
    const authz = req.headers.get("authorization") || "";
    if (authz) {
      // API key flow: require specific scope
      const ctx = await getCreatorContextFromApiKey(req as any);
      requireScope(ctx, "sl.apikeys:read");
      const result = await auth.api.listApiKeys({ headers: { Authorization: authz } as any });
      return NextResponse.json({ items: result?.apiKeys ?? [] }, { status: 200 });
    }

    // Session flow (dashboard): use cookies
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const result = await auth.api.listApiKeys({ headers: req.headers as any });
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
    const authz = req.headers.get("authorization") || "";
    const body = await req.json();
    const { name, scopes, metadata } = body || {};

    if (authz) {
      const ctx = await getCreatorContextFromApiKey(req as any);
      requireScope(ctx, "sl.apikeys:write");
      const created = await auth.api.createApiKey({
        body: { name, metadata: { ...(metadata || {}), permissions: (scopes || []).join(" ") } },
        headers: { Authorization: authz } as any,
      });
      return NextResponse.json(created, { status: 201 });
    }

    // Session flow
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const created = await auth.api.createApiKey({
      body: { name, metadata: { ...(metadata || {}), permissions: (scopes || []).join(" ") } },
      headers: req.headers as any,
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
    const keyId = req.nextUrl.searchParams.get("id");
    if (!keyId) return NextResponse.json({ error: "missing_id" }, { status: 400 });

    const authz = req.headers.get("authorization") || "";
    if (authz) {
      const ctx = await getCreatorContextFromApiKey(req as any);
      requireScope(ctx, "sl.apikeys:write");
      await auth.api.deleteApiKey({ body: { id: keyId }, headers: { Authorization: authz } as any });
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // Session flow
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    await auth.api.deleteApiKey({ body: { id: keyId }, headers: req.headers as any });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    if (e.message?.includes("missing_bearer")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (e.message?.includes("forbidden")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
