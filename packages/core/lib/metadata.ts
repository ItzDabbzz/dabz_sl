import type { Metadata } from "next/types";

export function createMetadata(override: Metadata): Metadata {
	return {
		...override,
		openGraph: {
			title: override.title ?? undefined,
			description: override.description ?? undefined,
			url: "https://sl.itzdabbzz.me",
			images: "https://sl.itzdabbzz.me/og.png",
			siteName: "Better Auth",
			...override.openGraph,
		},
		twitter: {
			card: "summary_large_image",
			creator: "@ItzDabbzz",
			title: override.title ?? undefined,
			description: override.description ?? undefined,
			images: "https://sl.itzdabbzz.me/og.png",
			...override.twitter,
		},
	};
}

export const baseUrl =
	process.env.NODE_ENV === "development"
		? new URL("http://localhost:3000")
		: new URL(`https://sl.itzdabbzz.me`);
