"use client";

/**
 * Talking to the creator profile API.
 *
 * The console and the API are two sides of the same thing, so they talk
 * to each other over HTTP rather than sharing code. That way the API is
 * exercised the way a third party would exercise it, and a rule that
 * only exists in the console cannot drift away from the rule the API
 * enforces.
 */

/** A failure the API described. */
export class ProfileApiError extends Error {
    readonly code: string;

    constructor(code: string, message: string) {
        super(message);
        this.name = "ProfileApiError";
        this.code = code;
    }
}

/** Call the API and read its answer. */
export async function profileApi<T>(
    path: string,
    init?: RequestInit,
): Promise<T> {
    const res = await fetch(path, {
        ...init,
        credentials: "include",
        headers: {
            "content-type": "application/json",
            ...(init?.headers ?? {}),
        },
    });

    const text = await res.text();
    let data: any = null;
    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = null;
        }
    }

    if (!res.ok) {
        throw new ProfileApiError(
            data?.error ?? "request_failed",
            data?.message ??
                `The request failed (${res.status}).`,
        );
    }

    return data as T;
}

/** The parts of a profile the console shows. */
export type ProfileSummary = {
    id: string;
    slug: string;
    displayName: string;
    ownerType: string;
    ownerName: string | null;
    published: boolean;
};

/** A claimed Second Life account. */
export type ProfileAccount = {
    id: string;
    profileId: string;
    slAccountName: string;
    slAccountUuid: string | null;
    verified: boolean;
    verifiedAt: string | null;
    verificationMethod: string | null;
    verificationCode: string | null;
    rejectedAt: string | null;
    rejectionReason: string | null;
    createdAt: string | null;
};

/** A product on the page. */
export type ProfileItem = {
    id: string;
    title: string;
    price: string | null;
    image: string | null;
    soldBy: string | null;
    store: string | null;
    featured: boolean;
};

/** A page, in full. */
export type ProfileDetail = {
    id: string;
    slug: string;
    displayName: string;
    tagline: string | null;
    bio: string | null;
    avatarUrl: string | null;
    bannerUrl: string | null;
    websiteUrl: string | null;
    locations: string | null;
    ownerType: string;
    ownerId: string;
    ownerName: string | null;
    published: boolean;
    updatedAt: string | null;
};
