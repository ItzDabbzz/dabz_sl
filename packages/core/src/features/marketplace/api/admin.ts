export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isConfiguredAdminId } from "@/server/auth/roles";
import { getSessionFromRequest } from "@/server/auth/session";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    const userId = (session?.user as any)?.id as string | undefined;
    const isAdmin = isConfiguredAdminId(userId);
    return NextResponse.json({ isAdmin });
  } catch {
    return NextResponse.json({ isAdmin: false });
  }
}
