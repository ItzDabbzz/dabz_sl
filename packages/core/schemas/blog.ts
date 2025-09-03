import {
    pgTable,
    uuid,
    text,
    timestamp,
    boolean,
    index,
    uniqueIndex,
    integer,
    jsonb,
} from "drizzle-orm/pg-core";

// Blog categories (flat list for now)
export const blogCategories = pgTable(
    "blog_categories",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        slug: text("slug").notNull(),
        name: text("name").notNull(),
        description: text("description"),
        // Visibility rules (public/login/restricted with role/org/team/user/email whitelists)
        visibility: jsonb("visibility"),
        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (t) => ({
        slugUnique: uniqueIndex("blog_categories_slug_uniq").on(t.slug),
        byCreated: index("blog_categories_created_idx").on(t.createdAt),
    }),
);

// Blog posts
export const blogPosts = pgTable(
    "blog_posts",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        slug: text("slug").notNull(),
        title: text("title").notNull(),
        excerpt: text("excerpt"),
        contentMd: text("content_md").notNull(), // store raw markdown to preserve whitespace
        authorUserId: text("author_user_id"),

        published: boolean("published").default(false).notNull(),
        publishedAt: timestamp("published_at", { withTimezone: true }),

        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (t) => ({
        slugUnique: uniqueIndex("blog_posts_slug_uniq").on(t.slug),
        byPublished: index("blog_posts_published_idx").on(
            t.published,
            t.publishedAt,
        ),
        byCreated: index("blog_posts_created_idx").on(t.createdAt),
    }),
);

// Many-to-many: posts <-> categories
export const blogPostCategories = pgTable(
    "blog_post_categories",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        postId: uuid("post_id").notNull(),
        categoryId: uuid("category_id").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (t) => ({
        uniq: uniqueIndex("blog_post_categories_uniq").on(
            t.postId,
            t.categoryId,
        ),
        byPost: index("blog_post_categories_post_idx").on(t.postId),
        byCategory: index("blog_post_categories_category_idx").on(t.categoryId),
    }),
);

// Ratings for blog posts
export const blogPostRatings = pgTable(
    "blog_post_ratings",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        postId: uuid("post_id").notNull(),
        userId: text("user_id"), // optional (allow anonymous ratings)
        score: integer("score").notNull(), // 1..10
        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (t) => ({
        byPost: index("blog_post_ratings_post_idx").on(t.postId),
        byUser: index("blog_post_ratings_user_idx").on(t.userId),
        uniqPerUser: uniqueIndex("blog_post_ratings_post_user_uniq").on(
            t.postId,
            t.userId,
        ),
    }),
);

// Global settings for the blog (singleton row)
export const blogSettings = pgTable(
    "blog_settings",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        // Featured/hero categories
        heroCategoryId: uuid("hero_category_id"),
        featuredCategoryId: uuid("featured_category_id"),

        // SEO defaults
        seoTitleSuffix: text("seo_title_suffix"),
        seoDefaultDescription: text("seo_default_description"),
        seoOgImageUrl: text("seo_og_image_url"),

        // Ratings display
        enableRatingsSummary: boolean("enable_ratings_summary").default(true).notNull(),

        // Email on first publish
        enableEmailOnPublish: boolean("enable_email_on_publish").default(false).notNull(),
        emailTemplateSubject: text("email_template_subject"),
        emailTemplateHtml: text("email_template_html"),

        createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    },
    (t) => ({
        createdIdx: index("blog_settings_created_idx").on(t.createdAt),
    }),
);

// Track one-time publish announcement per post
export const blogPostAnnouncements = pgTable(
    "blog_post_announcements",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        postId: uuid("post_id").notNull(),
        sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    },
    (t) => ({
        uniqPost: uniqueIndex("blog_post_announcements_post_uniq").on(t.postId),
        byPost: index("blog_post_announcements_post_idx").on(t.postId),
    }),
);
