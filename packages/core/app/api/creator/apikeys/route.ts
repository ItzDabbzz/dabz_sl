import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCreatorContextFromApiKey, requireScope } from "@/lib/creator-auth";
import { db } from "@/lib/db";
import { apiKey as apiKeyTable } from "@/schemas/auth-schema";
import { auditLogs } from "@/schemas/sl-schema";
import { and, desc, eq, sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auditKeyId = req.nextUrl.searchParams.get("auditKeyId");
  const q = (req.nextUrl.searchParams.get("q") || "").toLowerCase();
  const limit = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get("limit") || "20", 10) || 20, 1), 200);
  const offset = Math.max(parseInt(req.nextUrl.searchParams.get("offset") || "0", 10) || 0, 0);
  const sortKey = (req.nextUrl.searchParams.get("sortKey") as "name" | "createdAt" | "lastUsedAt" | null) || "createdAt";
  const sortDir = (req.nextUrl.searchParams.get("sortDir") as "asc" | "desc" | null) || "desc";
    const authz = req.headers.get("authorization") || "";
    if (authz) {
      // API key flow: require specific scope
      const ctx = await getCreatorContextFromApiKey(req as any);
      requireScope(ctx, "sl.apikeys:read");
      if (auditKeyId) {
        // ownership check
        const owned = await db
          .select({ id: apiKeyTable.id })
          .from(apiKeyTable)
          .where(and(eq(apiKeyTable.id as any, auditKeyId as any), eq(apiKeyTable.userId as any, ctx.userId as any)))
          .limit(1);
        if (!owned?.length) return NextResponse.json({ error: "not_found" }, { status: 404 });
        const logs = await db
          .select()
          .from(auditLogs)
          .where(sql`(metadata->>'keyId') = ${auditKeyId}`)
          .orderBy(desc(auditLogs.createdAt as any))
          .limit(50);
        return NextResponse.json({ items: logs }, { status: 200 });
      }
  const result = await auth.api.listApiKeys({ headers: { Authorization: authz } as any });
  let items = (result as any)?.apiKeys ?? (Array.isArray(result) ? result : []);
  if (q) items = items.filter((k: any) => (k?.name || "").toLowerCase().includes(q) || String(k?.id || "").includes(q));
  items = items.sort((a: any, b: any) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortKey === "name") return dir * String(a?.name || "").localeCompare(String(b?.name || ""));
    const av = a?.[sortKey] ? new Date(a[sortKey]).getTime() : 0;
    const bv = b?.[sortKey] ? new Date(b[sortKey]).getTime() : 0;
    return dir * (av - bv);
  });
  const sliced = items.slice(offset, offset + limit);
  const hasMore = offset + sliced.length < items.length;
  return NextResponse.json({ items: sliced, page: { limit, offset, hasMore, total: items.length } }, { status: 200 });
    }

    // Session flow (dashboard): use cookies
  const session = await auth.api.getSession({ headers: req.headers as any });
  if (!session) return NextResponse.json({ error: "unauthorized", reason: "missing_session" }, { status: 401 });
  if (auditKeyId) {
    const owned = await db
      .select({ id: apiKeyTable.id })
      .from(apiKeyTable)
      .where(and(eq(apiKeyTable.id as any, auditKeyId as any), eq(apiKeyTable.userId as any, (session as any).user.id as any)))
      .limit(1);
    if (!owned?.length) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const logs = await db
      .select()
      .from(auditLogs)
      .where(sql`(metadata->>'keyId') = ${auditKeyId}`)
      .orderBy(desc(auditLogs.createdAt as any))
      .limit(50);
    return NextResponse.json({ items: logs }, { status: 200 });
  }
  const result = await auth.api.listApiKeys({ headers: req.headers as any });
  let items = (result as any)?.apiKeys ?? (Array.isArray(result) ? result : []);
  if (q) items = items.filter((k: any) => (k?.name || "").toLowerCase().includes(q) || String(k?.id || "").includes(q));
  items = items.sort((a: any, b: any) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortKey === "name") return dir * String(a?.name || "").localeCompare(String(b?.name || ""));
    const av = a?.[sortKey] ? new Date(a[sortKey]).getTime() : 0;
    const bv = b?.[sortKey] ? new Date(b[sortKey]).getTime() : 0;
    return dir * (av - bv);
  });
  const sliced = items.slice(offset, offset + limit);
  const hasMore = offset + sliced.length < items.length;
  return NextResponse.json({ items: sliced, page: { limit, offset, hasMore, total: items.length } }, { status: 200 });
  } catch (e: any) {
  if (e.message?.includes("missing_bearer")) return NextResponse.json({ error: "unauthorized", reason: "missing_bearer" }, { status: 401 });
  if (e.message?.includes("forbidden")) return NextResponse.json({ error: "forbidden", reason: "insufficient_scope" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authz = req.headers.get("authorization") || "";
    let body: any = {};
    try {
      body = await req.json();
    } catch {}
    const name = (body?.name as string) || "New Key";
    const scopes = Array.isArray(body?.scopes) ? (body.scopes as string[]) : [];
    const metadata = body?.metadata as Record<string, any> | undefined;
    const confirmStar = Boolean(body?.confirmStar);
    if (scopes?.includes("*") && scopes.filter(Boolean).length > 1 && !confirmStar) {
      return NextResponse.json({ error: "star_mixed", reason: "Using '*' with other scopes requires confirmation." }, { status: 400 });
    }

    if (authz) {
      const ctx = await getCreatorContextFromApiKey(req as any);
      requireScope(ctx, "sl.apikeys:write");
      try {
        const created = await auth.api.createApiKey({
          body: { name, metadata: { ...(metadata || {}), permissions: (scopes || []).join(" ") } },
          headers: { Authorization: authz } as any,
        });
        // Audit log
        try {
          await db.insert(auditLogs).values({
            actorType: "user",
            actorId: ctx.userId as any,
            scopeType: "user",
            scopeId: ctx.userId as any,
            eventType: "apiKey.created",
            metadata: { keyId: (created as any)?.id, name, scopes },
          } as any);
        } catch {}
        return NextResponse.json(created, { status: 201 });
      } catch (e: any) {
        const msg = e?.status || e?.statusCode ? String(e?.status || e?.statusCode) : "";
        const b = e?.body ? JSON.stringify(e.body) : "";
        if (msg === "400" || e?.statusCode === 400) {
          if (b.includes("Metadata is disabled") || (e?.body && String(e.body).includes("Metadata is disabled"))) {
            // Retry without metadata
            const created = await auth.api.createApiKey({
              body: { name },
              headers: { Authorization: authz } as any,
            });
            try {
              await db.insert(auditLogs).values({
                actorType: "user",
                actorId: ctx.userId as any,
                scopeType: "user",
                scopeId: ctx.userId as any,
                eventType: "apiKey.created",
                metadata: { keyId: (created as any)?.id, name, scopes, metadataDisabled: true },
              } as any);
            } catch {}
            return NextResponse.json({ ...created, metadataDisabled: true }, { status: 201 });
          }
        }
        throw e;
      }
    }

    // Session flow
  const session = await auth.api.getSession({ headers: req.headers as any });
  if (!session) return NextResponse.json({ error: "unauthorized", reason: "missing_session" }, { status: 401 });
    try {
      const created = await auth.api.createApiKey({
        body: { name, metadata: { ...(metadata || {}), permissions: (scopes || []).join(" ") } },
        headers: req.headers as any,
      });
      try {
        await db.insert(auditLogs).values({
          actorType: "user",
          actorId: (session as any).user.id as any,
          scopeType: "user",
          scopeId: (session as any).user.id as any,
          eventType: "apiKey.created",
          metadata: { keyId: (created as any)?.id, name, scopes },
        } as any);
      } catch {}
      return NextResponse.json(created, { status: 201 });
    } catch (e: any) {
      const msg = e?.status || e?.statusCode ? String(e?.status || e?.statusCode) : "";
      const b = e?.body ? JSON.stringify(e.body) : "";
      if (msg === "400" || e?.statusCode === 400) {
        if (b.includes("Metadata is disabled") || (e?.body && String(e.body).includes("Metadata is disabled"))) {
          const created = await auth.api.createApiKey({
            body: { name },
            headers: req.headers as any,
          });
          try {
            await db.insert(auditLogs).values({
              actorType: "user",
              actorId: (session as any).user.id as any,
              scopeType: "user",
              scopeId: (session as any).user.id as any,
              eventType: "apiKey.created",
              metadata: { keyId: (created as any)?.id, name, scopes, metadataDisabled: true },
            } as any);
          } catch {}
          return NextResponse.json({ ...created, metadataDisabled: true }, { status: 201 });
        }
      }
      throw e;
    }
  } catch (e: any) {
  if (e.message?.includes("missing_bearer")) return NextResponse.json({ error: "unauthorized", reason: "missing_bearer" }, { status: 401 });
  if (e.message?.includes("forbidden")) return NextResponse.json({ error: "forbidden", reason: "insufficient_scope" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    let keyId = req.nextUrl.searchParams.get("id");
    let body: any = {};
    try { body = await req.json(); } catch {}
    if (!keyId) keyId = body?.id;
    const reason = (body?.reason as string) || undefined;
    if (!keyId) return NextResponse.json({ error: "missing_id" }, { status: 400 });

    const authz = req.headers.get("authorization") || "";
    if (authz) {
      const ctx = await getCreatorContextFromApiKey(req as any);
      requireScope(ctx, "sl.apikeys:write");
  await auth.api.deleteApiKey({ body: { keyId }, headers: { Authorization: authz } as any });
      try {
        await db.insert(auditLogs).values({
          actorType: "user",
          actorId: ctx.userId as any,
          scopeType: "user",
          scopeId: ctx.userId as any,
          eventType: "apiKey.revoked",
          metadata: { keyId, reason },
        } as any);
      } catch {}
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // Session flow
  const session = await auth.api.getSession({ headers: req.headers as any });
  if (!session) return NextResponse.json({ error: "unauthorized", reason: "missing_session" }, { status: 401 });
  await auth.api.deleteApiKey({ body: { keyId }, headers: req.headers as any });
    try {
      await db.insert(auditLogs).values({
        actorType: "user",
        actorId: (session as any).user.id as any,
        scopeType: "user",
        scopeId: (session as any).user.id as any,
        eventType: "apiKey.revoked",
        metadata: { keyId, reason },
      } as any);
    } catch {}
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
  if (e.message?.includes("missing_bearer")) return NextResponse.json({ error: "unauthorized", reason: "missing_bearer" }, { status: 401 });
  if (e.message?.includes("forbidden")) return NextResponse.json({ error: "forbidden", reason: "insufficient_scope" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const keyId = req.nextUrl.searchParams.get("id");
    if (!keyId) return NextResponse.json({ error: "missing_id" }, { status: 400 });
    let body: any = {};
    try { body = await req.json(); } catch {}
    const scopes: string[] = Array.isArray(body?.scopes) ? body.scopes.filter(Boolean) : [];
    const confirmStar = Boolean(body?.confirmStar);
    if (scopes?.includes("*") && scopes.filter(Boolean).length > 1 && !confirmStar) {
      return NextResponse.json({ error: "star_mixed", reason: "Using '*' with other scopes requires confirmation." }, { status: 400 });
    }
    const updatePayload: Record<string, any> = {};
    if (typeof body?.name === "string") updatePayload.name = body.name.slice(0, 200);
    if (typeof body?.enabled === "boolean") updatePayload.enabled = body.enabled;
    if (typeof body?.expiresAt === "string") {
      const d = new Date(body.expiresAt);
      updatePayload.expiresAt = isNaN(d.getTime()) ? null : d.toISOString() as any;
    }
    if (typeof body?.rateLimitEnabled === "boolean") updatePayload.rateLimitEnabled = body.rateLimitEnabled;
    if (Number.isFinite(body?.rateLimitTimeWindow)) updatePayload.rateLimitTimeWindow = Math.max(0, Number(body.rateLimitTimeWindow));
    if (Number.isFinite(body?.rateLimitMax)) updatePayload.rateLimitMax = Math.max(0, Number(body.rateLimitMax));
    // Scopes stored as space-separated string in permissions column
    if (Array.isArray(scopes)) updatePayload.permissions = scopes.join(" ");

    const authz = req.headers.get("authorization") || "";
    if (authz) {
      const ctx = await getCreatorContextFromApiKey(req as any);
      requireScope(ctx, "sl.apikeys:write");
      const res = await db
        .update(apiKeyTable)
        .set(updatePayload)
        .where(and(eq(apiKeyTable.id as any, keyId as any), eq(apiKeyTable.userId as any, ctx.userId as any)));
      try {
        await db.insert(auditLogs).values({
          actorType: "user",
          actorId: ctx.userId as any,
          scopeType: "user",
          scopeId: ctx.userId as any,
          eventType: "apiKey.updated",
          metadata: { keyId, changes: Object.keys(updatePayload) },
        } as any);
      } catch {}
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // Session flow
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session) return NextResponse.json({ error: "unauthorized", reason: "missing_session" }, { status: 401 });
    await db
      .update(apiKeyTable)
      .set(updatePayload)
      .where(and(eq(apiKeyTable.id as any, keyId as any), eq(apiKeyTable.userId as any, (session as any).user.id as any)));
    try {
      await db.insert(auditLogs).values({
        actorType: "user",
        actorId: (session as any).user.id as any,
        scopeType: "user",
        scopeId: (session as any).user.id as any,
        eventType: "apiKey.updated",
        metadata: { keyId, changes: Object.keys(updatePayload) },
      } as any);
    } catch {}
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    if (e.message?.includes("missing_bearer")) return NextResponse.json({ error: "unauthorized", reason: "missing_bearer" }, { status: 401 });
    if (e.message?.includes("forbidden")) return NextResponse.json({ error: "forbidden", reason: "insufficient_scope" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
