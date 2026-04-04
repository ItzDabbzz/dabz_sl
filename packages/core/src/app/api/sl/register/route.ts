export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { masterObjects, objectInstances, userConfigs } from "@/schemas/sl-schema";
import { SlRegisterBody, SlRegisterResponse } from "@/schemas/sl.zod";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { generateToken, hashToken, makeConfigHash, makeEtagFromHash, stableStringify } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = SlRegisterBody.parse(body);

    // Ensure master object exists
    const [mo] = await db
      .select()
      .from(masterObjects)
      .where(eq(masterObjects.id, parsed.masterObjectId));
    if (!mo) return NextResponse.json({ error: "master_object_not_found" }, { status: 404 });

    // Find or create instance (unique ownerSlUuid + masterObjectId)
    const [existing] = await db
      .select()
      .from(objectInstances)
      .where(and(eq(objectInstances.masterObjectId, parsed.masterObjectId), eq(objectInstances.ownerSlUuid, parsed.ownerUuid)));

    const token = generateToken(32);
    const tokenHash = hashToken(token);
    const now = new Date();
    const expires = new Date(now.getTime() + 1000 * 60 * 15); // 15 minutes

    let instanceId: string;

    if (existing) {
      await db
        .update(objectInstances)
        .set({ instanceTokenHash: tokenHash, tokenExpiresAt: expires, lastSeenAt: now, status: "active" })
        .where(eq(objectInstances.id, existing.id));
      instanceId = existing.id;
    } else {
      const inserted = await db
        .insert(objectInstances)
        .values({
          masterObjectId: parsed.masterObjectId,
          ownerSlUuid: parsed.ownerUuid,
          instanceTokenHash: tokenHash,
          tokenExpiresAt: expires,
          version: parsed.version ?? mo.currentVersion ?? 1,
          region: parsed.region,
          firstSeenAt: now,
          lastSeenAt: now,
        })
        .returning({ id: objectInstances.id });
      instanceId = inserted[0].id;
    }

    // Prepare default config and etag
    const defaultConfig = mo.defaultConfigJson ?? {};
    const configHash = makeConfigHash(defaultConfig);
    const etag = makeEtagFromHash(configHash);

    // Optionally set activeConfig on first create
    if (!existing) {
      const [cfg] = await db
        .insert(userConfigs)
        .values({ instanceId, configJson: defaultConfig })
        .returning({ id: userConfigs.id });

      await db
        .update(objectInstances)
        .set({ activeConfigId: cfg.id, currentConfigHash: configHash })
        .where(eq(objectInstances.id, instanceId));
    }

    const response: z.infer<typeof SlRegisterResponse> = {
      instanceId,
      token,
      tokenExpiresAt: expires.toISOString(),
      defaultConfig,
      etag,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "invalid_body", details: e.issues }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });



  }
}
