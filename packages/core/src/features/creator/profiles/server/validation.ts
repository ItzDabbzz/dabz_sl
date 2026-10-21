/**
 * The rules for a creator profile.
 *
 * These are pure functions - no database, no session - so both the API and
 * the dashboard can rely on the same answer about what a slug may look like
 * and what a field may contain.
 *
 * The page a creator owns is a public thing: its address is in a URL that
 * people share, and its text is read by strangers. So the rules here are
 * deliberately strict about shape (a slug is a slug) and about size (a
 * field is a field, not a document).
 */

/** The longest a slug may be. */
export const SLUG_MAX = 48;
/** The shortest a slug may be. */
export const SLUG_MIN = 3;

/** How long a display name may be. */
export const DISPLAY_NAME_MAX = 80;
/** How long a tagline may be. */
export const TAGLINE_MAX = 200;
/** How long a bio may be. */
export const BIO_MAX = 4000;
/** How long the location list may be. */
export const LOCATIONS_MAX = 1000;
/** How long a URL may be. */
export const URL_MAX = 500;
/**
 * How long a picture held in the profile may be.
 *
 * A picture the creator uploads is kept in the row itself, so it is
 * longer than a link: the limit is the size of the picture, not of an
 * address.
 */
export const IMAGE_MAX = 6 * 1024 * 1024;
/** How long a Second Life account name may be. */
export const SL_ACCOUNT_NAME_MAX = 64;

/**
 * The addresses the site already uses.
 *
 * A creator page lives at /c/<slug>, so /c/api is technically free - but
 * a page that answers to a name people expect to be a feature of the site
 * is a trap. These are refused.
 */
export const RESERVED_SLUGS = new Set([
    "api",
    "admin",
    "blog",
    "c",
    "dashboard",
    "edit",
    "help",
    "login",
    "logout",
    "marketplace",
    "new",
    "public",
    "settings",
    "signup",
    "sl",
    "support",
    "terms",
    "privacy",
    "user",
    "userprofile",
    "webhooks",
]);

/**
 * Turn a name into something that can sit in a URL.
 *
 * The result is not guaranteed to be valid or free - it may be empty, too
 * short, or already taken. It is the starting point, not the answer.
 */
export function slugifyProfileSlug(input: string | null | undefined): string {
    return (input ?? "")
        .toLowerCase()
        .normalize("NFKD")
        // Keep letters and digits from the decomposed form only.
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-+|-+$)/g, "")
        .slice(0, SLUG_MAX)
        .replace(/-+$/g, "");
}

/** Whether a slug may be used as the address of a page. */
export function isValidProfileSlug(slug: string): boolean {
    if (typeof slug !== "string") return false;
    const value = slug.trim();
    if (value.length < SLUG_MIN || value.length > SLUG_MAX) return false;
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(value)) return false;
    if (value.includes("--")) return false;
    if (RESERVED_SLUGS.has(value)) return false;
    return true;
}

/**
 * Whether a value is a uuid.
 *
 * The pages, the accounts and the products are addressed by uuid. A value
 * that is not one is not a page - it is a mistake, and it has to be
 * answered as one rather than passed to the database, which would refuse
 * it in a way that looks like a fault in the server.
 */
export function isUuid(value: unknown): boolean {
    return (
        typeof value === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            value,
        )
    );
}

/** The shape of a field that may be changed on a profile. */
export type ProfilePatch = {
    displayName?: string;
    slug?: string;
    tagline?: string | null;
    bio?: string | null;
    avatarUrl?: string | null;
    bannerUrl?: string | null;
    websiteUrl?: string | null;
    locations?: string | null;
    published?: boolean;
};

/** A field that was refused, and why. */
export type FieldError = {
    field: string;
    message: string;
};

function isBlank(value: unknown): boolean {
    return (
        value === undefined ||
        value === null ||
        (typeof value === "string" && value.trim() === "")
    );
}

function trimmedOrNull(value: unknown, max: number): string | null {
    if (isBlank(value)) return null;
    const text = String(value).trim();
    if (text.length > max) return null;
    return text;
}

/**
 * Check a URL that will be put in an href or an image src.
 *
 * Only http and https are allowed. A page that loads an image from
 * anywhere else is a page that can be pointed at a visitor's machine, so
 * the schemes that do that are refused.
 */
export function isAllowedProfileUrl(value: string): boolean {
    // A picture the creator uploaded is kept as it is - bytes and all -
    // so an animated GIF stays animated. It is not a link, so it is
    // allowed to be long.
    if (value.startsWith("data:image/")) {
        return value.length <= IMAGE_MAX;
    }
    if (value.length > URL_MAX) return false;
    let parsed: URL;
    try {
        parsed = new URL(value);
    } catch {
        return false;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return false;
    }
    return true;
}

/**
 * Check the fields a caller wants to change.
 *
 * Only the fields on a profile may be changed, and each is checked on its
 * own: a refused field is named, so the caller can be told which one.
 */
export function validateProfilePatch(
    body: unknown,
): { ok: true; value: ProfilePatch } | { ok: false; error: FieldError } {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return {
            ok: false,
            error: { field: "body", message: "A body is required." },
        };
    }
    const input = body as Record<string, unknown>;
    const value: ProfilePatch = {};

    if (input.displayName !== undefined) {
        const name = String(input.displayName ?? "").trim();
        if (!name) {
            return {
                ok: false,
                error: {
                    field: "displayName",
                    message: "A name is required.",
                },
            };
        }
        if (name.length > DISPLAY_NAME_MAX) {
            return {
                ok: false,
                error: {
                    field: "displayName",
                    message: `A name may be at most ${DISPLAY_NAME_MAX} characters.`,
                },
            };
        }
        value.displayName = name;
    }

    if (input.slug !== undefined) {
        const slug = String(input.slug ?? "").trim().toLowerCase();
        if (!isValidProfileSlug(slug)) {
            return {
                ok: false,
                error: {
                    field: "slug",
                    message: `An address may be ${SLUG_MIN}-${SLUG_MAX} characters of a-z, 0-9 and single dashes.`,
                },
            };
        }
        value.slug = slug;
    }

    if (input.tagline !== undefined) {
        const tagline = trimmedOrNull(input.tagline, TAGLINE_MAX);
        if (tagline === null && !isBlank(input.tagline)) {
            return {
                ok: false,
                error: {
                    field: "tagline",
                    message: `A tagline may be at most ${TAGLINE_MAX} characters.`,
                },
            };
        }
        value.tagline = tagline;
    }

    if (input.bio !== undefined) {
        const bio = trimmedOrNull(input.bio, BIO_MAX);
        if (bio === null && !isBlank(input.bio)) {
            return {
                ok: false,
                error: {
                    field: "bio",
                    message: `A bio may be at most ${BIO_MAX} characters.`,
                },
            };
        }
        value.bio = bio;
    }

    if (input.locations !== undefined) {
        const locations = trimmedOrNull(input.locations, LOCATIONS_MAX);
        if (locations === null && !isBlank(input.locations)) {
            return {
                ok: false,
                error: {
                    field: "locations",
                    message: `The location list may be at most ${LOCATIONS_MAX} characters.`,
                },
            };
        }
        value.locations = locations;
    }

    // A picture may be a picture the creator uploaded, which is kept in
    // the row; a website is only ever a link.
    for (const field of ["avatarUrl", "bannerUrl"] as const) {
        if (input[field] === undefined) continue;
        const raw = String(input[field] ?? "").trim();
        if (!raw) {
            value[field] = null;
            continue;
        }
        if (!isAllowedProfileUrl(raw)) {
            return {
                ok: false,
                error: {
                    field,
                    message:
                        "A picture must be a file of at most 4 MB, or a full http or https address.",
                },
            };
        }
        value[field] = raw;
    }

    if (input.websiteUrl !== undefined) {
        const raw = String(input.websiteUrl ?? "").trim();
        if (!raw) {
            value.websiteUrl = null;
        } else if (!isAllowedProfileUrl(raw) || raw.startsWith("data:")) {
            return {
                ok: false,
                error: {
                    field: "websiteUrl",
                    message: "A link must be a full http or https address.",
                },
            };
        } else {
            value.websiteUrl = raw;
        }
    }

    if (input.published !== undefined) {
        if (typeof input.published !== "boolean") {
            return {
                ok: false,
                error: {
                    field: "published",
                    message: "Published must be true or false.",
                },
            };
        }
        value.published = input.published;
    }

    return { ok: true, value };
}

/**
 * Check a Second Life account name.
 *
 * The name is what the platform matches products against, so it is kept
 * exactly as written - only the edges are trimmed. Second Life names are
 * case-sensitive in-world and creators write them with capitals.
 */
export function validateSlAccountName(
    value: unknown,
): { ok: true; value: string } | { ok: false; error: FieldError } {
    const name = String(value ?? "").trim();
    if (!name) {
        return {
            ok: false,
            error: { field: "slAccountName", message: "An account name is required." },
        };
    }
    if (name.length > SL_ACCOUNT_NAME_MAX) {
        return {
            ok: false,
            error: {
                field: "slAccountName",
                message: `An account name may be at most ${SL_ACCOUNT_NAME_MAX} characters.`,
            },
        };
    }
    // Control characters have no place in a name and would break the page.
    // eslint-disable-next-line no-control-regex
    if (/[\u0000-\u001f\u007f]/.test(name)) {
        return {
            ok: false,
            error: {
                field: "slAccountName",
                message: "An account name may not contain control characters.",
            },
        };
    }
    return { ok: true, value: name };
}
