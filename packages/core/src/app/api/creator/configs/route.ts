export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { userConfigs } from "@/schemas/sl-schema";
import { and, desc, eq } from "drizzle-orm";
import { requirePermission } from "@/lib/guards";

export async function GET(req: NextRequest) {
    try {
        await requirePermission("sldb.view", req.headers as any);

        const { searchParams } = new URL(req.url);
        const instanceId = searchParams.get("instanceId") || undefined;

        // For now, scope down by user (can be adjusted to org/team when SLDB object ownership is fully org-scoped)
        const sesResp = await (
            await import("@/server/auth/core")
        ).auth.api.getSession({ headers: req.headers as any });
        const userId = (sesResp as any)?.user?.id as string;

        const conditions: any[] = [
            eq(userConfigs.createdByUserId, userId as any) as any,
        ];
        if (instanceId)
            conditions.push(eq(userConfigs.instanceId, instanceId as any));

        const where =
            conditions.length === 1 ? conditions[0] : and(...conditions);

        const rows = await db
            .select()
            .from(userConfigs)
            .where(where)
            .orderBy(desc(userConfigs.createdAt))
            .limit(200);
        return NextResponse.json({ items: rows }, { status: 200 });
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
