export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { Redis } from "@upstash/redis";

// CORS headers for Second Life
const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

interface WearingItem {
	name: string;
	creator: string;
	point: number;
	creatorName?: string;
	mpSearch?: string;
}

interface WearingSession {
	items: WearingItem[];
	createdAt: number;
	expiresAt: number;
	metadata?: {
		freeSlots?: number;
		sharedPoints?: number[];
	};
}

const SESSION_TTL_SECONDS = 6 * 60 * 60; // 6 hours

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getRedis(): any {
	return new Redis({
		url: process.env.sl_KV_REST_API_URL!,
		token: process.env.sl_KV_REST_API_TOKEN!,
	});
}

function sessionKey(id: string) {
	return `wearing:session:${id}`;
}

// OPTIONS: Handle CORS preflight
export async function OPTIONS() {
	return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// POST: Create or update a wearing session
export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const { sessionId, item, complete, metadata } = body;

		// Validate item structure
		if (!item || !item.name || !item.creator || item.point === undefined) {
			return NextResponse.json(
				{ error: "Invalid item data" },
				{ status: 400 }
			);
		}

		const redis = getRedis();
		const now = Date.now();
		let sid: string = sessionId;
		let session: WearingSession;

		if (sid) {
			const rawExisting = await redis.get(sessionKey(sid)) as string | null;
			const existing: WearingSession | null = rawExisting
				? (typeof rawExisting === "string" ? JSON.parse(rawExisting) : rawExisting) as WearingSession
				: null;
			if (existing) {
				session = existing;
				session.items.push(item);
				session.expiresAt = now + SESSION_TTL_SECONDS * 1000;
				if (metadata) session.metadata = metadata;
			} else {
				// Session gone (expired or never existed) — start fresh
				sid = nanoid(16);
				session = {
					items: [item],
					createdAt: now,
					expiresAt: now + SESSION_TTL_SECONDS * 1000,
					metadata,
				};
			}
		} else {
			sid = nanoid(16);
			session = {
				items: [item],
				createdAt: now,
				expiresAt: now + SESSION_TTL_SECONDS * 1000,
				metadata,
			};
		}

		await redis.set(sessionKey(sid), JSON.stringify(session), { ex: SESSION_TTL_SECONDS });

		return NextResponse.json(
			{
				sessionId: sid,
				itemCount: session.items.length,
				complete: complete || false,
			},
			{ headers: corsHeaders }
		);
	} catch (error) {
		console.error("[Wearing API] Error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}

// GET: Retrieve wearing session data
export async function GET(req: NextRequest) {
	const sessionId = req.nextUrl.searchParams.get("session");

	if (!sessionId) {
		return NextResponse.json(
			{ error: "Missing session parameter" },
			{ status: 400 }
		);
	}

	const redis = getRedis();
	const raw = await redis.get(sessionKey(sessionId)) as string | null;
	const session: WearingSession | null = raw
		? (typeof raw === "string" ? JSON.parse(raw) : raw) as WearingSession
		: null;

	if (!session) {
		return NextResponse.json(
			{ error: "Session not found or expired" },
			{ status: 404 }
		);
	}

	return NextResponse.json(
		{
			items: session.items,
			itemCount: session.items.length,
			expiresAt: session.expiresAt,
			metadata: session.metadata,
		},
		{ headers: corsHeaders }
	);
}
