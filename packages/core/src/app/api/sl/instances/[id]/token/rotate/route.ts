import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { objectInstances } from "@/schemas/sl-schema";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { generateToken, hashToken } from "@/lib/utils";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
  const { id } = await params;

    const [inst] = await db.select().from(objectInstances).where(eq(objectInstances.id, id));
    if (!inst) return NextResponse.json({ error: "instance_not_found" }, { status: 404 });

    const token = generateToken(32);
    const tokenHash = hashToken(token);
    const now = new Date();
    const expires = new Date(now.getTime() + 1000 * 60 * 15);

    await db
      .update(objectInstances)
      .set({ instanceTokenHash: tokenHash, tokenExpiresAt: expires })
      .where(eq(objectInstances.id, id));

    return NextResponse.json({ token, tokenExpiresAt: expires.toISOString() }, { status: 200 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });



  }
}
