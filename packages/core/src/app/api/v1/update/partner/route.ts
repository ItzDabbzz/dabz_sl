export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "@/lib/auth/better-auth";
import { getPartnerData, updatePartnerData } from "@/lib/fertility/data";

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
  const data = await getPartnerData(userId);
  return NextResponse.json(data);
}

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
  const result = await updatePartnerData(userId, payload);
  return NextResponse.json(result);



}
