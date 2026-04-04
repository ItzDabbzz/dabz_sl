export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";

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

// In-memory session storage (upgrade to Redis for production)
const sessions = new Map<string, WearingSession>();

// Clean up expired sessions every 30 minutes
setInterval(() => {
	const now = Date.now();
	for (const [sessionId, session] of sessions.entries()) {
		if (session.expiresAt < now) {
			sessions.delete(sessionId);
		}
	}
}, 30 * 60 * 1000);

// OPTIONS: Handle CORS preflight
export async function OPTIONS() {
	return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// POST: Create or update a wearing session
export async function POST(req: NextRequest) {
	console.log("[Wearing API] POST request received");
	console.log("[Wearing API] URL:", req.url);
	console.log("[Wearing API] Headers:", Object.fromEntries(req.headers.entries()));

	try {
		const body = await req.json();
		console.log("[Wearing API] Body:", body);
		const { sessionId, item, complete, metadata } = body;

		// Validate item structure
		if (!item || !item.name || !item.creator || item.point === undefined) {
			return NextResponse.json(
				{ error: "Invalid item data" },
				{ status: 400 }
			);
		}

		const now = Date.now();
		const expiresAt = now + 6 * 60 * 60 * 1000; // 6 hours

		let sid = sessionId;
		let session: WearingSession;

		if (sid && sessions.has(sid)) {
			// Add to existing session
			session = sessions.get(sid)!;
			session.items.push(item);
			session.expiresAt = expiresAt; // Extend expiry

			// Update metadata if provided (usually on final complete request)
			if (metadata) {
				session.metadata = metadata;
			}
		} else {
			// Create new session
			sid = nanoid(16);
			session = {
				items: [item],
				createdAt: now,
				expiresAt,
				metadata,
			};
			sessions.set(sid, session);
		}

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
	const searchParams = req.nextUrl.searchParams;
	const sessionId = searchParams.get("session");

	if (!sessionId) {
		return NextResponse.json(
			{ error: "Missing session parameter" },
			{ status: 400 }
		);
	}

	const session = sessions.get(sessionId);
	if (!session) {
		return NextResponse.json(
			{ error: "Session not found or expired" },
			{ status: 404 }
		);
	}

	// Check if expired
	if (session.expiresAt < Date.now()) {
		sessions.delete(sessionId);
		return NextResponse.json(
			{ error: "Session expired" },
			{ status: 410 }
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
