import { createHmac, timingSafeEqual as tSafeEqual, createHash } from "crypto";
import { db } from "@/server/db/client";
import { objectInstances } from "@/schemas/sl-schema";
import { eq } from "drizzle-orm";

export type InstanceAuthContext = {
  instanceId: string;
};

// Verify HMAC headers for instance requests
// Headers: X-Instance-Id, X-Timestamp, X-Signature
// Body: raw string used in signature
export async function verifyInstanceSignature(opts: {
  headers: Record<string, string | undefined>;
  rawBody: string;
  maxSkewMs?: number;
}): Promise<InstanceAuthContext> {
  const { headers, rawBody } = opts;
  const maxSkewMs = opts.maxSkewMs ?? 60_000;

  const instanceId = headers["x-instance-id"] || (headers as any)["X-Instance-Id"]; // Node header keys are lowercased
  const ts = headers["x-timestamp"] || (headers as any)["X-Timestamp"]; // ISO or unix ms
  const sig = headers["x-signature"] || (headers as any)["X-Signature"]; // hex/base64

  if (!instanceId || !ts || !sig) throw new Error("missing_auth_headers");

  const tsMs = Number.isNaN(Number(ts)) ? Date.parse(ts as string) : Number(ts);
  if (!Number.isFinite(tsMs)) throw new Error("invalid_timestamp");
  if (Math.abs(Date.now() - tsMs) > maxSkewMs) throw new Error("timestamp_skew");

  const [inst] = await db.select().from(objectInstances).where(eq(objectInstances.id, instanceId as string));
  if (!inst || !inst.instanceTokenHash) throw new Error("instance_not_authorized");

  const toSign = `${instanceId}\n${ts}\n${rawBody}`;
  const h = createHmac("sha256", Buffer.from(inst.instanceTokenHash, "hex"));
  // Note: we use tokenHash as key for simplicity in v1. Client must HMAC with SHA256(token) as key.
  const digest = h.update(toSign).digest("hex");

  // Constant-time compare
  if (!timingSafeEqual(sig as string, digest)) throw new Error("invalid_signature");

  return { instanceId: instanceId as string };
}

function timingSafeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, isHex(a) ? "hex" : "utf8");
  const bb = Buffer.from(b, isHex(b) ? "hex" : "utf8");
  if (ba.length !== bb.length) return false;
  return tSafeEqual(ba, bb);
}

function isHex(s: string) {
  return /^[0-9a-fA-F]+$/.test(s);
}

// Simple signer for tests/playground (client should hash token before HMAC)
export function signForTest(instanceId: string, token: string, ts: string | number, rawBody: string): string {
  const t = typeof ts === "number" ? String(ts) : ts;
  const toSign = `${instanceId}\n${t}\n${rawBody}`;
  const tokenHashHex = createHash("sha256").update(token).digest("hex");
  return createHmac("sha256", Buffer.from(tokenHashHex, "hex")).update(toSign).digest("hex");
}
