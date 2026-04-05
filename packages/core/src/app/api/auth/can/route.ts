import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/server/auth/guards";
import { headers } from "next/headers";

export async function GET(req: NextRequest) {
  const key = (req.nextUrl.searchParams.get("key") || "").trim();
  if (!key) return NextResponse.json({ allowed: false });
  try {
    await requirePermission(key, await headers());
    return NextResponse.json({ allowed: true });
  } catch {
    return NextResponse.json({ allowed: false });
  }
}
