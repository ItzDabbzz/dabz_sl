export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { user as userTable } from "@/schemas/auth-schema";
import { eq } from "drizzle-orm";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const session = await auth.api.getSession({
            headers: req.headers as any,
        });
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "unauthorized" },
                { status: 401 },
            );
        }

        // Fetch caller role
        const [caller] = await db
            .select({ id: userTable.id, role: userTable.role })
            .from(userTable)
            .where(eq(userTable.id as any, session.user.id as any) as any);

        const role = (caller?.role || "user").toString();
        const allowed = new Set(["owner", "developer", "admin", "mod"]);
        if (!allowed.has(role)) {
            return NextResponse.json({ error: "forbidden" }, { status: 403 });
        }

        const { name } = await req.json().catch(() => ({}));
        const newName = typeof name === "string" ? name.trim() : "";
        if (!newName || newName.length > 120) {
            return NextResponse.json(
                { error: "invalid_name" },
                { status: 400 },
            );
        }

    const { id: userId } = await params;
        await db
            .update(userTable)
            .set({ name: newName as any, updatedAt: new Date() as any })
            .where(eq(userTable.id as any, userId as any) as any);

        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: "server_error" }, { status: 500 });


    }
}
