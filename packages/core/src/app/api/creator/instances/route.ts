export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { objectInstances } from "@/schemas/sl-schema";
import { and, desc, eq } from "drizzle-orm";
import { getCreatorContextFromApiKey } from "@/lib/creator-auth";
import { requirePermission } from "@/lib/guards";

export async function GET(req: NextRequest) {
    try {
        await requirePermission("sldb.view", req.headers as any);

        const { searchParams } = new URL(req.url);
        const masterObjectId = searchParams.get("masterObjectId") || undefined;
        const ownerSlUuid = searchParams.get("ownerSlUuid") || undefined;
        const status = searchParams.get("status") || undefined;

        const ctx = await getCreatorContextFromApiKey(req as any);
        const conditions: any[] = [];

        // Scope enforcement
        if (ctx.targets?.orgId)
            conditions.push(
                eq(objectInstances.orgId, ctx.targets.orgId as any),
            );
        else if (ctx.targets?.teamId)
            conditions.push(
                eq(objectInstances.teamId, ctx.targets.teamId as any),
            );
        else
            conditions.push(eq(objectInstances.ownerUserId, ctx.userId as any));

        if (masterObjectId)
            conditions.push(
                eq(objectInstances.masterObjectId, masterObjectId as any),
            );
        if (ownerSlUuid)
            conditions.push(
                eq(objectInstances.ownerSlUuid, ownerSlUuid as any),
            );
        if (status) conditions.push(eq(objectInstances.status, status as any));

        const where =
            conditions.length === 1 ? conditions[0] : and(...conditions);
        const rows = await db
            .select()
            .from(objectInstances)
            .where(where)
            .orderBy(desc(objectInstances.createdAt))
            .limit(200);

        return NextResponse.json({ items: rows }, { status: 200 });
    } catch (e: any) {
        if (
            e?.message === "unauthorized" ||
            e.message?.includes("missing_bearer")
        ) {
            return NextResponse.json(
                { error: "unauthorized" },
                { status: 401 },
            );
        }
        if (e?.message === "forbidden" || e.message?.includes("forbidden")) {
            return NextResponse.json({ error: "forbidden" }, { status: 403 });
        }
        console.error(e);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        await requirePermission("sldb.edit", req.headers as any);
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        if (e?.message === "unauthorized")
            return NextResponse.json(
                { error: "unauthorized" },
                { status: 401 },
            );
        if (e?.message === "forbidden")
            return NextResponse.json({ error: "forbidden" }, { status: 403 });
        console.error(e);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        await requirePermission("sldb.edit", req.headers as any);
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        if (e?.message === "unauthorized")
            return NextResponse.json(
                { error: "unauthorized" },
                { status: 401 },
            );
        if (e?.message === "forbidden")
            return NextResponse.json({ error: "forbidden" }, { status: 403 });
        console.error(e);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        await requirePermission("sldb.edit", req.headers as any);
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        if (e?.message === "unauthorized")
            return NextResponse.json(
                { error: "unauthorized" },
                { status: 401 },
            );
        if (e?.message === "forbidden")
            return NextResponse.json({ error: "forbidden" }, { status: 403 });
        console.error(e);
        return NextResponse.json({ error: "server_error" }, { status: 500 });



    }
}
