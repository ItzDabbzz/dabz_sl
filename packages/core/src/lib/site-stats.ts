import { unstable_cache } from "next/cache";
import { count, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { mpCategories, mpItemCategories, mpItems } from "@/schemas/sl-schema";

const SECOND_LIFE_FEED_REVALIDATE_SECONDS = 300;
const MARKETPLACE_STATS_REVALIDATE_SECONDS = 600;

export type HomeFeed = {
	signups?: number;
	signups_updated_unix?: number;
	signups_updated_slt?: string;
	inworld?: number;
	inworld_updated_unix?: number;
	inworld_updated_slt?: string;
	exchange_rate?: number;
	exchange_rate_updated_unix?: number;
	exchange_rate_updated_slt?: string;
};

export type LindexWindow = {
	min_rate?: number;
	max_rate?: number;
	l_volume?: number;
	us_volume?: number;
};

export type LindexFeed = {
	updated_unix?: number;
	updated_slt?: string;
	market_buy?: {
		one_hour?: LindexWindow;
		one_day?: LindexWindow;
		today?: LindexWindow;
	};
	market_sell?: {
		one_hour?: LindexWindow;
		one_day?: LindexWindow;
		today?: LindexWindow;
	};
	limit_buy_best_10?: {
		min_rate?: number;
		max_rate?: number;
		l_offered?: number;
	};
	limit_sell_best_10?: {
		min_rate?: number;
		max_rate?: number;
		l_offered?: number;
	};
};

export type MarketplaceStats = {
	totalItems: number;
	totalCategories: number;
	distinctPrimaries: number;
	distinctSubs: number;
	itemsWithCategories: number;
	uncategorizedItems: number;
	lastItemUpdateIso: string | null;
};

export type SecondLifeSnapshot = {
	home: HomeFeed | null;
	lindex: LindexFeed | null;
};

const EMPTY_MARKETPLACE_STATS: MarketplaceStats = {
	totalItems: 0,
	totalCategories: 0,
	distinctPrimaries: 0,
	distinctSubs: 0,
	itemsWithCategories: 0,
	uncategorizedItems: 0,
	lastItemUpdateIso: null,
};

function parseKeyValueText(text: string): Record<string, string> {
	const lines = text
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
	const result: Record<string, string> = {};

	for (let index = 0; index < lines.length - 1; index += 2) {
		result[lines[index]] = lines[index + 1];
	}

	return result;
}

function toNumber(value?: string | null): number | undefined {
	if (value == null) return undefined;

	const parsed = Number(String(value).replace(/[^0-9.\-]/g, ""));
	return Number.isFinite(parsed) ? parsed : undefined;
}

function mapHomeFeed(feed: Record<string, string>): HomeFeed {
	return {
		signups: toNumber(feed.signups),
		signups_updated_unix: toNumber(feed.signups_updated_unix),
		signups_updated_slt: feed.signups_updated_slt,
		inworld: toNumber(feed.inworld),
		inworld_updated_unix: toNumber(feed.inworld_updated_unix),
		inworld_updated_slt: feed.inworld_updated_slt,
		exchange_rate: toNumber(feed.exchange_rate),
		exchange_rate_updated_unix: toNumber(feed.exchange_rate_updated_unix),
		exchange_rate_updated_slt: feed.exchange_rate_updated_slt,
	};
}

function mapLindexFeed(feed: Record<string, string>): LindexFeed {
	const getWindow = (prefix: string): LindexWindow => ({
		min_rate: toNumber(feed[`${prefix}_min_rate`]),
		max_rate: toNumber(feed[`${prefix}_max_rate`]),
		l_volume: toNumber(feed[`${prefix}_l$`]),
		us_volume: toNumber(feed[`${prefix}_us$`]),
	});

	return {
		updated_unix: toNumber(feed.updated_unix),
		updated_slt: feed.updated_slt,
		market_buy: {
			one_hour: getWindow("mb_1h"),
			one_day: getWindow("mb_1d"),
			today: getWindow("mb_t"),
		},
		market_sell: {
			one_hour: getWindow("ms_1h"),
			one_day: getWindow("ms_1d"),
			today: getWindow("ms_t"),
		},
		limit_buy_best_10: {
			min_rate: toNumber(feed["lb_10%_min_rate"]),
			max_rate: toNumber(feed["lb_10%_max_rate"]),
			l_offered: toNumber(feed["lb_10%_l$_offer"]),
		},
		limit_sell_best_10: {
			min_rate: toNumber(feed["ls_10%_min_rate"]),
			max_rate: toNumber(feed["ls_10%_max_rate"]),
			l_offered: toNumber(feed["ls_10%_l$_offer"]),
		},
	};
}

async function fetchText(url: string, timeoutMs = 8000): Promise<string | null> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const response = await fetch(url, {
			next: {
				revalidate: SECOND_LIFE_FEED_REVALIDATE_SECONDS,
				tags: ["sl:feeds"],
			},
			signal: controller.signal,
		});
		if (!response.ok) return null;

		return await response.text();
	} catch {
		return null;
	} finally {
		clearTimeout(timeout);
	}
}

export const getSecondLifeSnapshot = unstable_cache(
	async (): Promise<SecondLifeSnapshot> => {
		const [homeText, lindexText] = await Promise.all([
			fetchText("https://api.secondlife.com/datafeeds/homepage.txt"),
			fetchText("https://api.secondlife.com/datafeeds/lindex.txt"),
		]);

		return {
			home: homeText ? mapHomeFeed(parseKeyValueText(homeText)) : null,
			lindex: lindexText ? mapLindexFeed(parseKeyValueText(lindexText)) : null,
		};
	},
	["second-life:snapshot"],
	{
		revalidate: SECOND_LIFE_FEED_REVALIDATE_SECONDS,
		tags: ["sl:feeds"],
	},
);

export const getMarketplaceStats = unstable_cache(
	async (): Promise<MarketplaceStats> => {
		try {
			const [{ value: totalItems }] = (await db
				.select({ value: count() })
				.from(mpItems)) as Array<{ value: number | null }>;
			const [{ value: totalCategories }] = (await db
				.select({ value: count() })
				.from(mpCategories)) as Array<{ value: number | null }>;
			const [{ value: distinctPrimaries }] = (await db
				.select({
					value: sql<number>`count(distinct ${mpCategories.primary})`,
				})
				.from(mpCategories)) as Array<{ value: number | null }>;
			const [{ value: distinctSubs }] = (await db
				.select({
					value: sql<number>`count(distinct ${mpCategories.sub})`,
				})
				.from(mpCategories)) as Array<{ value: number | null }>;
			const [{ value: itemsWithCategories }] = (await db
				.select({
					value: sql<number>`count(distinct ${mpItemCategories.itemId})`,
				})
				.from(mpItemCategories)) as Array<{ value: number | null }>;
			const [{ value: lastItemUpdateIso }] = (await db
				.select({
					value: sql<string>`coalesce(max(${mpItems.updatedAt}), max(${mpItems.createdAt}))`,
				})
				.from(mpItems)) as Array<{ value: string | null }>;

			const totalItemsCount = Number(totalItems || 0);
			const itemsWithCategoriesCount = Number(itemsWithCategories || 0);

			return {
				totalItems: totalItemsCount,
				totalCategories: Number(totalCategories || 0),
				distinctPrimaries: Number(distinctPrimaries || 0),
				distinctSubs: Number(distinctSubs || 0),
				itemsWithCategories: itemsWithCategoriesCount,
				uncategorizedItems: Math.max(0, totalItemsCount - itemsWithCategoriesCount),
				lastItemUpdateIso: lastItemUpdateIso ? String(lastItemUpdateIso) : null,
			};
		} catch {
			return EMPTY_MARKETPLACE_STATS;
		}
	},
	["marketplace:stats"],
	{
		revalidate: MARKETPLACE_STATS_REVALIDATE_SECONDS,
		tags: ["marketplace:stats"],
	},
);
