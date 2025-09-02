# SL Creator System — TODO Roadmap

Status: draft
Owner: platform

## 0) Foundations
- [ ] Confirm env vars: DATABASE_URL, BETTER_AUTH_URL, COOKIE_DOMAIN, RESEND keys, admin IDs
- [ ] Move `adminUserIds` in `lib/auth.ts` to env (comma-separated) and parse at runtime
- [ ] Define ID strategy (ULID) and helper util for IDs
- [ ] Decide config max size limits and compression policy

## 1) Data model (Drizzle)
- [x] Add tables in `schemas/sl-schema.ts`:
  - [x] master_objects: id, name, description, ownerUserId?, orgId?, teamId?, currentVersion, configSchemaJson, defaultConfigJson, visibility, createdAt, updatedAt
  - [x] object_versions: id, masterObjectId, version, changelog, migrationRef, createdAt
  - [x] object_instances: id, masterObjectId, ownerSlUuid, status, firstSeenAt, lastSeenAt, instanceTokenHash, tokenExpiresAt, tokenVersion, deviceFingerprint, region, version
  - [x] user_configs: id, instanceId, versionTag, configJson, isActive, createdByUserId?, createdAt
  - [x] config_snapshots: id, instanceId, sourceConfigId, label, diffJson, createdAt
  - [x] entitlements: id, ownerSlUuid, masterObjectId, source (marketplace|inworld), proofRef, createdAt
  - [x] webhooks: id, scope (org|team|user), targetUrl, secret, events[], active, createdAt
  - [x] audit_logs: id, actorUserId?, actorType (user|instance|apiKey), scope (org|team|user), type, metadata, createdAt
  - [x] webhook_deliveries: id, webhookId?, targetUrl, event, requestJson, responseStatus, responseBody, error, signature, durationMs, createdAt
- [ ] Constraints/checks:
  - [ ] Master objects: exactly one of (ownerUserId, orgId, teamId) is set
  - [x] Instances unique: (ownerSlUuid, masterObjectId)
  - [ ] Only one active config per instance (`isActive` partial unique)
- [x] Indexes:
  - [x] object_instances: (ownerSlUuid, masterObjectId), (masterObjectId), (orgId, teamId, ownerUserId)
  - [x] user_configs: (instanceId, createdAt desc)
  - [x] entitlements: (ownerSlUuid, masterObjectId)
- [x] Migrations: `pnpm db:generate` -> review -> `pnpm db:migrate`
- [ ] Seed script (optional): example master object + defaults

## 2) Better Auth: API keys, org/teams, scopes
- [x] Keep `apiKey()` plugin enabled in `lib/auth.ts`
- [ ] Add metadata to API keys: scopes and scope-targets (orgId|teamId|masterObjectId)
- [ ] Add service-account flag for server-only keys
- [x] Guard util: `getCreatorContextFromApiKey(req)` returns { userId, scopes, targets, orgId?, teamId? }
- [ ] Enforce RBAC (owner/admin/developer/support) via `organization()` plugin roles
- [x] OpenAPI: tag creator/admin endpoints; include API key security scheme

## 3) Instance tokens & request signing
- [x] Token format: short-lived, per-instance; store only hash + expiry + version
- [x] HMAC scheme: headers `X-Instance-Id`, `X-Timestamp`, `X-Signature`
- [x] Clock skew allowance (±60s) & replay protection (signature cache)
- [x] Rotation endpoint to mint new token; revoke on server and instruct client
- [x] Rate limiting by instanceId, owner UUID, and IP (Redis in prod, memory in dev)
- [x] Utility: `verifyInstanceSignature(req)` + `signForTest(body, ts, token)`

## 4) REST API (Next.js routes)
Public (LSL; HMAC required):
- [x] POST `app/api/sl/register/route.ts` — first-run handshake; returns instanceId, token (short TTL), defaults, ETag
- [x] GET `app/api/sl/instances/[id]/route.ts` — instance details
- [x] GET `app/api/sl/instances/[id]/config/route.ts` — supports ETag/If-None-Match
- [x] POST `app/api/sl/instances/[id]/config/route.ts` — create new config version + snapshot
- [x] POST `app/api/sl/instances/[id]/snapshots/[snapshotId]/restore/route.ts`
- [x] POST `app/api/sl/entitlements/route.ts` — from unpacker/vendor
- [x] POST `app/api/sl/instances/[id]/token/rotate/route.ts`

Creator/Admin (Better Auth API key; scope checks):
- [x] `app/api/creator/master-objects` (list, create)
- [x] `app/api/creator/master-objects/[id]` (get, update, delete)
- [x] `app/api/creator/master-objects/[id]/versions`
- [x] `app/api/creator/instances` (search) + token rotate/revoke
- [x] `app/api/creator/webhooks` (CRUD)
- [x] `app/api/creator/apikeys` (create with scopes/targets, list, revoke)

Cross-cutting:
- [x] Middleware/guards for API key vs instance HMAC and attach auth context
- [x] Consistent error model (codes, messages) and 429 handling
- [x] ETag generation based on config hash/version

## 5) LSL client (reference script)
- [ ] First-run: POST /register with masterObjectId, ownerUuid, fingerprint, version
- [ ] Persist instanceId and last config ETag
- [ ] Poll config (interval + backoff) with If-None-Match; apply deltas
- [ ] POST changes to /config (small diffs preferred)
- [ ] Handle token rotation message from server
- [ ] Respect HTTP payload limits; compact JSON; chunk if needed

## 6) Dashboard UI (Next.js)
- [ ] Master Objects: list/create/edit; JSON Schema editor for defaults
- [ ] Versions: changelog, migration ref, promote version
- [ ] Instances: search/filter, owner UUID, lastSeen, status
- [ ] Configs: view active, history timeline, diff viewer
- [ ] Snapshots: create, label, restore
- [ ] Entitlements: list by owner UUID and object
- [ ] API Keys: create with scopes/targets; revoke; last used
- [ ] Webhooks: CRUD + test; delivery log
- [ ] Tools: HMAC signing playground; OpenAPI docs viewer

## 7) Observability & safety
- [x] Audit logs for every config change/token rotation (actor, scope, diff)
  - [x] Token rotation/revoke logged
  - [x] Config changes logged
  - [x] Snapshot restore logged
- [ ] Heartbeat/lastSeen updates and anomaly detection (many instances per owner/ip)
- [ ] Webhook events: config.changed, instance.registered, snapshot.created
- [ ] Soft-delete + restore for instances/configs

## 8) Security posture
- [ ] Threat model for LSL token leakage; blast-radius controls
- [ ] Secrets management; never embed long-lived secrets in LSL
- [ ] CORS & allowed origins; TLS only
- [ ] Abuse prevention: per-route limits; body size caps; captcha for public admin forms if any

## 9) Testing & quality
- [ ] Unit tests: signing util, ETag logic, scope enforcement
- [ ] Integration tests: register -> config fetch -> update -> snapshot -> restore
- [ ] Contract tests for OpenAPI (creator and LSL)
- [ ] Load tests for hot endpoints with realistic payload sizes

## 10) Rollout
- [ ] Staging environment + seed data
- [ ] Data migration plan and rollbacks
- [ ] Feature flags for SL endpoints
- [ ] Docs+examples for vendors/unpackers

## Nice-to-haves
- [ ] Delta config protocol and server-side merge strategies (last-write-wins or shallow merge)
- [ ] Optional HTTP-in push (llRequestURL) path with renewal
- [ ] S3/object storage for large blobs referenced from config
- [ ] Analytics dashboard (adoption, active instances, config churn)

## Acceptance criteria (MVP)
- [x] Creator can define a master object with defaults and version
- [x] LSL object registers, receives instanceId + defaults, and persists config
- [x] Creator or owner can change config; versioned and restorable
- [ ] RBAC + API key scopes enforced
- [x] Basic rate limiting and audit logging live
