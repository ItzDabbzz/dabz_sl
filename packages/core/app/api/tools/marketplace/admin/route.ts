import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

function isAdminId(id: string | undefined | null) {
  const admins = (process.env.BETTER_AUTH_ADMIN_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
  return !!id && admins.includes(id);
}

export async function GET(req: NextRequest) {
  try {
    const ses = await auth.api.getSession({ headers: req.headers as any });
    const userId = (ses?.user as any)?.id as string | undefined;
    const isAdmin = isAdminId(userId);
    return NextResponse.json({ isAdmin });
  } catch {
    return NextResponse.json({ isAdmin: false });
  }
}
