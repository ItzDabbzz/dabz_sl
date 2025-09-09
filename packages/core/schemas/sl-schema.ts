import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
  uniqueIndex,
  numeric,
} from "drizzle-orm/pg-core";

// Master Objects (creator-defined templates)
export const masterObjects = pgTable(
  "sl_master_objects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),

    // Ownership scope: exactly one should be set (enforced at app level for now)
    ownerUserId: text("owner_user_id"),
    orgId: text("org_id"),
    teamId: text("team_id"),

    currentVersion: integer("current_version").default(1).notNull(),
    configSchemaJson: jsonb("config_schema_json"),
    defaultConfigJson: jsonb("default_config_json"),
    visibility: text("visibility").default("private").notNull(), // private | org | public

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    byOwner: index("sl_master_objects_owner_idx").on(t.ownerUserId),
    byOrg: index("sl_master_objects_org_idx").on(t.orgId),
    byTeam: index("sl_master_objects_team_idx").on(t.teamId),
  })
);

// Object Versions (schema/config versioning for a master object)
export const objectVersions = pgTable(
  "sl_object_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    masterObjectId: uuid("master_object_id").notNull(),
    version: integer("version").notNull(),
    changelog: text("changelog"),
    migrationRef: text("migration_ref"), // code reference or identifier

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    byMaster: index("sl_object_versions_master_idx").on(t.masterObjectId),
    byMasterVersion: uniqueIndex("sl_object_versions_master_version_uniq").on(
      t.masterObjectId,
      t.version
    ),
  })
);

// Object Instances (a unique copy tied to an SL user)
export const objectInstances = pgTable(
  "sl_object_instances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    masterObjectId: uuid("master_object_id").notNull(),

    // Second Life owner UUID (UUID from SL)
    ownerSlUuid: uuid("owner_sl_uuid").notNull(),

    status: text("status").default("active").notNull(), // active | revoked | suspended

    // Instance token management
    instanceTokenHash: text("instance_token_hash"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    tokenVersion: integer("token_version").default(1).notNull(),

    // Device/region/version info from LSL environment
    deviceFingerprint: text("device_fingerprint"),
    region: text("region"),
    version: integer("version").default(1).notNull(),

    // Config tracking
    activeConfigId: uuid("active_config_id"), // reference to user_configs.id when active
    currentConfigHash: text("current_config_hash"),

    // Scope inheritance (optional)
    ownerUserId: text("owner_user_id"),
    orgId: text("org_id"),
    teamId: text("team_id"),

    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    byMaster: index("sl_object_instances_master_idx").on(t.masterObjectId),
    byOwner: index("sl_object_instances_owner_idx").on(t.ownerSlUuid),
    byScope: index("sl_object_instances_scope_idx").on(t.orgId, t.teamId, t.ownerUserId),
    ownerMasterUnique: uniqueIndex("sl_object_instances_owner_master_uniq").on(
      t.ownerSlUuid,
      t.masterObjectId
    ),
  })
);

// User Configs (versioned config per instance)
export const userConfigs = pgTable(
  "sl_user_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    instanceId: uuid("instance_id").notNull(),
    versionTag: text("version_tag"), // optional semantic tag
    configJson: jsonb("config_json").notNull(),

    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    byInstance: index("sl_user_configs_instance_idx").on(t.instanceId),
    byInstanceCreated: index("sl_user_configs_instance_created_idx").on(
      t.instanceId,
      t.createdAt
    ),
  })
);

// Config Snapshots (labelled diffs and restore points)
export const configSnapshots = pgTable(
  "sl_config_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    instanceId: uuid("instance_id").notNull(),
    sourceConfigId: uuid("source_config_id").notNull(),
    label: text("label"),
    diffJson: jsonb("diff_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    byInstance: index("sl_config_snapshots_instance_idx").on(t.instanceId),
  })
);

// Entitlements (proof of purchase/delivery)
export const entitlements = pgTable(
  "sl_entitlements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerSlUuid: uuid("owner_sl_uuid").notNull(),
    masterObjectId: uuid("master_object_id").notNull(),
    source: text("source").notNull(), // marketplace | inworld
    proofRef: text("proof_ref"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    ownerMasterUnique: uniqueIndex("sl_entitlements_owner_master_uniq").on(
      t.ownerSlUuid,
      t.masterObjectId
    ),
  })
);

// Webhooks (per scope)
export const webhooks = pgTable(
  "sl_webhooks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scopeType: text("scope_type").notNull(), // org | team | user
    scopeId: uuid("scope_id").notNull(),
    targetUrl: text("target_url").notNull(),
    secret: text("secret").notNull(),
    events: jsonb("events").notNull(), // array of event keys
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    byScope: index("sl_webhooks_scope_idx").on(t.scopeType, t.scopeId),
    byActive: index("sl_webhooks_active_idx").on(t.active),
  })
);

// Audit Logs
export const auditLogs = pgTable(
  "sl_audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorType: text("actor_type").notNull(), // user | instance | apiKey
    actorId: uuid("actor_id"),
    scopeType: text("scope_type").notNull(), // org | team | user
    scopeId: uuid("scope_id"),
    eventType: text("event_type").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    byCreatedAt: index("sl_audit_logs_created_idx").on(t.createdAt),
    byScope: index("sl_audit_logs_scope_idx").on(t.scopeType, t.scopeId),
  })
);

// Webhook Deliveries (logs of outbound webhook attempts)
export const webhookDeliveries = pgTable(
  "sl_webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    webhookId: uuid("webhook_id"), // nullable for ad-hoc test deliveries
  destinationId: uuid("destination_id"), // optional: when delivery is for a specific destination
    targetUrl: text("target_url").notNull(),
    event: text("event").notNull(),
    requestJson: jsonb("request_json").notNull(),
    responseStatus: integer("response_status"),
    responseBody: text("response_body"),
    error: text("error"),
    signature: text("signature"),
  transport: text("transport"), // http | discord | other
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    byWebhook: index("sl_webhook_deliveries_webhook_idx").on(t.webhookId),
  byDestination: index("sl_webhook_deliveries_destination_idx").on(t.destinationId),
    byCreatedAt: index("sl_webhook_deliveries_created_idx").on(t.createdAt),
  })
);

// Discord integrations: embed presets and saved channels
export const discordEmbedPresets = pgTable(
  "sl_discord_embed_presets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scopeType: text("scope_type").notNull(), // org | team | user
  scopeId: text("scope_id").notNull(),
    name: text("name").notNull(),
    payloadJson: jsonb("payload_json").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    byScope: index("sl_discord_embed_presets_scope_idx").on(t.scopeType, t.scopeId),
  })
);

export const discordChannels = pgTable(
  "sl_discord_channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scopeType: text("scope_type").notNull(), // org | team | user
  scopeId: text("scope_id").notNull(),
    name: text("name").notNull(),
    webhookUrl: text("webhook_url").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    byScope: index("sl_discord_channels_scope_idx").on(t.scopeType, t.scopeId),
  })
);

// Webhook Destinations (fan-out targets like Discord or extra HTTP endpoints)
export const webhookDestinations = pgTable(
  "sl_webhook_destinations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    webhookId: uuid("webhook_id").notNull(),
    type: text("type").notNull(), // http | discord
    enabled: boolean("enabled").default(true).notNull(),
    events: jsonb("events").$type<string[]>().notNull(), // list of event keys or patterns
    configJson: jsonb("config_json").notNull(), // per-type config
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    byWebhook: index("sl_webhook_destinations_webhook_idx").on(t.webhookId),
    byEnabled: index("sl_webhook_destinations_enabled_idx").on(t.enabled),
  })
);

// Marketplace Categories (primary/sub hierachy)
export const mpCategories = pgTable(
  "sl_mp_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Owner scope (optional like other SL tables)
    ownerUserId: text("owner_user_id"),
    orgId: text("org_id"),
    teamId: text("team_id"),

    primary: text("primary").notNull(),
    sub: text("sub").default("All").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    byScope: index("sl_mp_categories_scope_idx").on(t.orgId, t.teamId, t.ownerUserId),
    uniq: uniqueIndex("sl_mp_categories_uniq").on(t.primary, t.sub, t.orgId, t.teamId, t.ownerUserId),
  })
);

// Marketplace Items (scraped)
export const mpItems = pgTable(
  "sl_mp_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Scope
    ownerUserId: text("owner_user_id"),
    orgId: text("org_id"),
    teamId: text("team_id"),

    url: text("url").notNull(),
    title: text("title").notNull(),
    version: text("version"),
    images: jsonb("images").$type<string[]>(),
    price: text("price"), // in L$
    creator: jsonb("creator").$type<{ name: string; link: string }>(),
    store: text("store"),
    permissions: jsonb("permissions").$type<{ copy: string; modify: string; transfer: string }>(),
    description: text("description"),
    features: jsonb("features").$type<string[]>(),
    contents: jsonb("contents").$type<string[]>(),
    updatedOn: text("updated_on"),

    // New: ratings
    ratingAvg: numeric("rating_avg"),
    ratingCount: integer("rating_count"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    byScope: index("sl_mp_items_scope_idx").on(t.orgId, t.teamId, t.ownerUserId),
    byUrl: uniqueIndex("sl_mp_items_url_uniq").on(t.url, t.orgId, t.teamId, t.ownerUserId),
  })
);

// Join: Items <-> Categories (many-to-many to allow multi-tagging)
export const mpItemCategories = pgTable(
  "sl_mp_item_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id").notNull(),
    categoryId: uuid("category_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniq: uniqueIndex("sl_mp_item_categories_uniq").on(t.itemId, t.categoryId),
    byItem: index("sl_mp_item_categories_item_idx").on(t.itemId),
    byCategory: index("sl_mp_item_categories_category_idx").on(t.categoryId),
  })
);

// Marketplace Item Requests (public submissions)
export const mpItemRequests = pgTable(
  "sl_mp_item_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Optional who submitted
    requestedByUserId: text("requested_by_user_id"),
    requesterEmail: text("requester_email"),

    // Item payload
    url: text("url").notNull(),
    title: text("title").notNull(),
    version: text("version"),
    images: jsonb("images").$type<string[]>(),
    price: text("price").notNull(),
    creator: jsonb("creator").$type<{ name: string; link: string }>().notNull(),
    store: text("store").notNull(),
    permissions: jsonb("permissions").$type<{ copy: string; modify: string; transfer: string }>().notNull(),
    description: text("description").notNull(),
    features: jsonb("features").$type<string[]>(),
    contents: jsonb("contents").$type<string[]>(),
    updatedOn: text("updated_on"),

    // Selected category ids (required)
    categoryIds: jsonb("category_ids").$type<string[]>().notNull(),

    // Moderation
    status: text("status").default("pending").notNull(), // pending | approved | rejected
    approvedByUserId: text("approved_by_user_id"),
    rejectedByUserId: text("rejected_by_user_id"),
    rejectReason: text("reject_reason"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    byStatus: index("sl_mp_item_requests_status_idx").on(t.status),
    byRequestedBy: index("sl_mp_item_requests_requested_by_idx").on(t.requestedByUserId),
    byUrl: uniqueIndex("sl_mp_item_requests_url_uniq").on(t.url),
  })
);