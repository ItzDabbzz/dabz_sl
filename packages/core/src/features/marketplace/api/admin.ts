export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { can } from "@/server/auth/guards";

export async function GET(req: NextRequest) {
  try {
    const isAdmin = await can("marketplace.moderate", req.headers as any);
    return NextResponse.json({ isAdmin });
  } catch {
    return NextResponse.json({ isAdmin: false });
  }
}
