import {
    pgTable,
    serial,
    varchar,
    integer,
    boolean,
    timestamp,
    jsonb,
} from "drizzle-orm/pg-core";

// Fertility Data
export const fertilityData = pgTable("fertility_data", {
    id: serial("id").primaryKey(),
    avatarKey: varchar("avatar_key", { length: 64 }).notNull(),
    cycleDay: integer("cycle_day"),
    cycleLength: integer("cycle_length"),
    status: varchar("status", { length: 32 }),
    ovulationDay: integer("ovulation_day"),
    fertileWindowStart: integer("fertile_window_start"),
    fertileWindowEnd: integer("fertile_window_end"),
    timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
});

// Pregnancy Data
export const pregnancyData = pgTable("pregnancy_data", {
    id: serial("id").primaryKey(),
    avatarKey: varchar("avatar_key", { length: 64 }).notNull(),
    pregnant: boolean("pregnant"),
    conceptionDate: timestamp("conception_date", { withTimezone: true }),
    dueDate: timestamp("due_date", { withTimezone: true }),
    trimester: integer("trimester"),
    weeks: integer("weeks"),
    timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
});

// Partner Data
export const partnerData = pgTable("partner_data", {
    id: serial("id").primaryKey(),
    avatarKey: varchar("avatar_key", { length: 64 }).notNull(),
    linked: boolean("linked"),
    partnerKey: varchar("partner_key", { length: 64 }),
    sharedData: boolean("shared_data"),
    permissions: jsonb("permissions"),
    timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
});

// Settings Data
export const settingsData = pgTable("settings_data", {
    id: serial("id").primaryKey(),
    avatarKey: varchar("avatar_key", { length: 64 }).notNull(),
    fertilityEnabled: boolean("fertility_enabled"),
    cycleLength: integer("cycle_length"),
    privacyMode: varchar("privacy_mode", { length: 32 }),
    timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
});
