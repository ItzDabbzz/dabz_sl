export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isStaffRequest } from "@/server/auth/guards";

export async function GET(req: NextRequest) {
  try {
    const isAdmin = await isStaffRequest(req);
    return NextResponse.json({ isAdmin });
  } catch {
    return NextResponse.json({ isAdmin: false });
  }
}
