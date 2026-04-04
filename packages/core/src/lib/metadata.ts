import type { Metadata } from "next/types";

export function createMetadata(override: Metadata): Metadata {
	return {
		...override,
		openGraph: {
			title: override.title ?? undefined,
			description: override.description ?? undefined,
			url: "https://www.sanctumrp.net",
			images: "https://www.sanctumrp.net/og.png",
			siteName: "Sanctum Realms Project",
			...override.openGraph,
		},
		twitter: {
			card: "summary_large_image",
			creator: "@ItzDabbzz",
			title: override.title ?? undefined,
			description: override.description ?? undefined,
			images: "https://www.sanctumrp.net/og.png",
			...override.twitter,
		},
	};
}

export const baseUrl =
	process.env.NODE_ENV === "development"
		? new URL("http://localhost:3000")
		: new URL(`https://www.sanctumrp.net`);
