import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "@/lib/auth/better-auth";
import { getAllFertilityData } from "@/lib/fertility/data";

export async function GET(req: NextRequest) {
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
    const data = await getAllFertilityData(userId);
    return NextResponse.json(data);
}
