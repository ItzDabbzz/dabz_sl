export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "@/lib/auth/better-auth";
import { syncFertilityData } from "@/lib/fertility/data";

export async function POST(req: NextRequest) {
    const auth = await requireApiKey(req);
    if (!auth || !auth.valid || !auth.key) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = auth.key.userId ?? auth.key.id;
    if (!userId) {
        return NextResponse.json(
            { error: "User ID not found" },
            { status: 400 },
        );
    }
    const payload = await req.json();
    const result = await syncFertilityData(userId, payload);
    return NextResponse.json(result);



}
