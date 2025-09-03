import { z } from "zod";
import "zod-openapi"; // augments Zod's .meta() with OpenAPI typings

// Common primitives
export const SlUuid = z
  .string()
  .uuid()
  .meta({ id: "SlUuid", description: "UUID v4 string", example: "550e8400-e29b-41d4-a716-446655440000" });

export const ETag = z
  .string()
  .min(1)
  .meta({ id: "ETag", description: "HTTP ETag for config/document versioning", example: '"b3f1b2c1"' });

export const Version = z.number().int().nonnegative().meta({ id: "Version", example: 1 });

// Fingerprint info sent by LSL on first run (best-effort fields)
export const SlFingerprint = z
  .object({
    objectId: z.string().optional(),
    scriptKey: z.string().optional(),
    inventoryHash: z.string().optional(),
    productSku: z.string().optional(),
    vendor: z.string().optional(),
  })
  .meta({ id: "SlFingerprint", description: "Best-effort identifiers to reduce spoofing and correlate deliveries" });

// 1) Register
export const SlRegisterBody = z
  .object({
    masterObjectId: SlUuid,
    ownerUuid: SlUuid,
    version: Version.optional(),
    region: z.string().optional(),
    fingerprint: SlFingerprint.optional(),
  })
  .meta({ id: "SlRegisterBody" });

export const SlRegisterResponse = z
  .object({
    instanceId: SlUuid,
    token: z.string().min(16),
    tokenExpiresAt: z.string().datetime(),
    defaultConfig: z.any().optional(),
    etag: ETag.optional(),
  })
  .meta({ id: "SlRegisterResponse" });

// 2) Config fetch
export const SlConfigResponse = z
  .object({
    instanceId: SlUuid,
    config: z.any(),
    etag: ETag,
    version: Version,
    updatedAt: z.string().datetime(),
  })
  .meta({ id: "SlConfigResponse" });

// 3) Config update
export const SlConfigUpdateBody = z
  .object({
    config: z.any(),
    versionTag: z.string().optional(),
  })
  .meta({ id: "SlConfigUpdateBody" });

export const SlConfigUpdateResponse = z
  .object({
    success: z.literal(true),
    activeConfigId: SlUuid,
    etag: ETag,
  })
  .meta({ id: "SlConfigUpdateResponse" });

// 4) Entitlements
export const SlEntitlementBody = z
  .object({
    ownerUuid: SlUuid,
    masterObjectId: SlUuid,
    source: z.enum(["marketplace", "inworld"]).meta({ example: "inworld" }),
    proofRef: z.string().optional(),
  })
  .meta({ id: "SlEntitlementBody" });

export const SlEntitlementResponse = z
  .object({ ok: z.boolean().default(true) })
  .meta({ id: "SlEntitlementResponse" });

// 5) Instance HMAC headers (documentation-only helper)
export const InstanceAuthHeaders = z
  .object({
    "X-Instance-Id": SlUuid,
    "X-Timestamp": z.string().meta({ description: "ISO8601 or UNIX ms timestamp" }),
    "X-Signature": z
      .string()
      .meta({ description: "HMAC signature: hex or base64 of canonical(body, ts, token)" }),
  })
  .meta({ id: "InstanceAuthHeaders" });

// 6) Instance details response
export const SlInstanceDetailsResponse = z
  .object({
    instanceId: SlUuid,
    masterObjectId: SlUuid,
    status: z.enum(["active", "revoked", "suspended"]).default("active"),
    version: Version,
    lastSeenAt: z.string().datetime(),
    etag: ETag.optional(),
    activeConfigId: SlUuid.optional(),
  })
  .meta({ id: "SlInstanceDetailsResponse" });

// 7) Token rotation response
export const SlTokenRotateResponse = z
  .object({
    token: z.string().min(16),
    tokenExpiresAt: z.string().datetime(),
  })
  .meta({ id: "SlTokenRotateResponse" });

export type TSlRegisterBody = z.infer<typeof SlRegisterBody>;
export type TSlRegisterResponse = z.infer<typeof SlRegisterResponse>;
export type TSlConfigResponse = z.infer<typeof SlConfigResponse>;
export type TSlConfigUpdateBody = z.infer<typeof SlConfigUpdateBody>;
export type TSlConfigUpdateResponse = z.infer<typeof SlConfigUpdateResponse>;
export type TSlEntitlementBody = z.infer<typeof SlEntitlementBody>;
export type TSlEntitlementResponse = z.infer<typeof SlEntitlementResponse>;
export type TSlInstanceDetailsResponse = z.infer<typeof SlInstanceDetailsResponse>;
export type TSlTokenRotateResponse = z.infer<typeof SlTokenRotateResponse>;
