import {
    pgTable,
    uuid,
    text,
    timestamp,
    boolean,
    index,
    uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Creator profiles.
 *
 * A profile is the public face of a creator: a person or a team of
 * creators selling in Second Life. It is the one page that gathers their
 * blog posts, their products and the Second Life accounts they have
 * proven they own.
 *
 * The owner is either a user or an organization - a team of creators
 * shares one page rather than each having their own.
 */
export const creatorProfiles = pgTable(
    "creator_profiles",
    {
        id: uuid("id").primaryKey().defaultRandom(),

        /** "user" or "organization". */
        ownerType: text("owner_type").notNull(),
        /** The user id or the organization id. */
        ownerId: text("owner_id").notNull(),

        /** The address of the public page, e.g. /c/moonlight-atelier. */
        slug: text("slug").notNull(),
        displayName: text("display_name").notNull(),
        tagline: text("tagline"),
        bio: text("bio"),
        avatarUrl: text("avatar_url"),
        bannerUrl: text("banner_url"),
        websiteUrl: text("website_url"),
        /** Second Life locations, one per line, shown on the page. */
        locations: text("locations"),

        /** Whether the page is visible to the public. */
        published: boolean("published").default(false).notNull(),

        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (t) => ({
        slugUnique: uniqueIndex("creator_profiles_slug_uniq").on(t.slug),
        ownerUnique: uniqueIndex("creator_profiles_owner_uniq").on(
            t.ownerType,
            t.ownerId,
        ),
        byOwner: index("creator_profiles_owner_idx").on(
            t.ownerType,
            t.ownerId,
        ),
    }),
);

/**
 * The Second Life accounts a creator has claimed.
 *
 * A claim starts unverified. It becomes verified when the platform sees
 * proof - for now, an object in-world that the account owns - so a page
 * can only list products that really belong to the person behind it.
 */
export const creatorSlAccounts = pgTable(
    "creator_sl_accounts",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        profileId: uuid("profile_id")
            .notNull()
            .references(() => creatorProfiles.id, { onDelete: "cascade" }),

        /** The account name, e.g. "Moonlight Atelier". */
        slAccountName: text("sl_account_name").notNull(),
        /** The avatar UUID, once it is known. */
        slAccountUuid: text("sl_account_uuid"),

        /** Whether the platform has seen proof the account is theirs. */
        verified: boolean("verified").default(false).notNull(),
        verifiedAt: timestamp("verified_at", { withTimezone: true }),
        /** How it was proved: "object" (in-world), "code", or "lsl". */
        verificationMethod: text("verification_method"),
        /** The one-time code an in-world object carries, when used. */
        verificationCode: text("verification_code"),
        /**
         * When a staff member turned the claim down. A turned-down claim
         * is kept rather than deleted: the creator can see why, and the
         * record of the decision stays.
         */
        rejectedAt: timestamp("rejected_at", { withTimezone: true }),
        /** Why the claim was turned down. */
        rejectionReason: text("rejection_reason"),

        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (t) => ({
        uniqPerProfile: uniqueIndex("creator_sl_accounts_profile_name_uniq").on(
            t.profileId,
            t.slAccountName,
        ),
        byProfile: index("creator_sl_accounts_profile_idx").on(t.profileId),
        byUuid: index("creator_sl_accounts_uuid_idx").on(t.slAccountUuid),
    }),
);

/**
 * The products a creator lists on their page.
 *
 * An item belongs to the store that sells it, so the link is made
 * explicitly rather than guessed. The item id is the marketplace item.
 */
export const creatorProfileItems = pgTable(
    "creator_profile_items",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        profileId: uuid("profile_id")
            .notNull()
            .references(() => creatorProfiles.id, { onDelete: "cascade" }),
        itemId: uuid("item_id").notNull(),

        /** Whether the creator chose to feature it on the page. */
        featured: boolean("featured").default(false).notNull(),

        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (t) => ({
        uniq: uniqueIndex("creator_profile_items_uniq").on(
            t.profileId,
            t.itemId,
        ),
        byProfile: index("creator_profile_items_profile_idx").on(t.profileId),
        byItem: index("creator_profile_items_item_idx").on(t.itemId),
    }),
);
