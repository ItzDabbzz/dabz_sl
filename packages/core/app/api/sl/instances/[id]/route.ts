import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { objectInstances } from "@/schemas/sl-schema";
import { SlInstanceDetailsResponse } from "@/schemas/sl.zod";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { makeEtagFromHash } from "@/lib/utils";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
  const { id } = await params;
    const [inst] = await db.select().from(objectInstances).where(eq(objectInstances.id, id));
    if (!inst) return NextResponse.json({ error: "instance_not_found" }, { status: 404 });

    const res: z.infer<typeof SlInstanceDetailsResponse> = {
      instanceId: inst.id,
      masterObjectId: inst.masterObjectId,
      status: (inst.status as any) ?? "active",
      version: inst.version ?? 1,
      lastSeenAt: inst.lastSeenAt?.toISOString?.() ?? new Date().toISOString(),
      etag: inst.currentConfigHash ? makeEtagFromHash(inst.currentConfigHash) : undefined,
      activeConfigId: inst.activeConfigId ?? undefined,
    };

    const headers: Record<string, string> = {};
    if (res.etag) headers.ETag = res.etag;

    return NextResponse.json(res, { status: 200, headers });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
