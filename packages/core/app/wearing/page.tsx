// Renders "What They Wearin'" data from a session or base64 JSON
// New mode: https://sanctumrp.net/wearing?session=SESSION_ID
// Legacy mode: https://sanctumrp.net/wearing?data=BASE64(JSON)

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface WearingItem {
	id?: string;
	name: string;
	point?: string | number;
	pointName?: string;
	creator?: string;
	creatorName?: string;
	mpSearch?: string;
	profileUrl?: string;
}

interface SessionMetadata {
	freeSlots?: number;
	sharedPoints?: number[];
}

export const dynamic = "force-dynamic";

// Legacy base64 decoding
function decodeItems(param?: string | string[]): WearingItem[] | null {
	if (!param) return null;
	const b64 = Array.isArray(param) ? param[0] : param;
	try {
		const json = Buffer.from(b64, "base64").toString("utf8");
		const data = JSON.parse(json);
		if (Array.isArray(data)) return data as WearingItem[];
		if (Array.isArray((data as any)?.items))
			return (data as any).items as WearingItem[];
		return null;
	} catch {
		return null;
	}
}

// Fetch from session API
async function fetchSessionData(
	sessionId: string
): Promise<{ items: WearingItem[]; metadata?: SessionMetadata } | null> {
	try {
		const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
		const res = await fetch(`${baseUrl}/api/sl/wearing?session=${sessionId}`, {
			cache: "no-store",
		});

		if (!res.ok) {
			console.error("[WhatTheyWearin] Session fetch failed:", res.status);
			return null;
		}

		const data = await res.json();
		return { items: data.items || [], metadata: data.metadata };
	} catch (error) {
		console.error("[WhatTheyWearin] Error fetching session:", error);
		return null;
	}
}

export default async function WhatTheyWearin({
	searchParams,
}: {
	searchParams?: Promise<Record<string, string | string[]>>;
}) {
	const params = await searchParams;
	console.log("[WhatTheyWearin] searchParams:", params);

	let items: WearingItem[] | null = null;
	let metadata: SessionMetadata | undefined = undefined;
	let mode: "session" | "legacy" | "none" = "none";

	// Try session mode first
	if (params?.session) {
		const sessionId = Array.isArray(params.session)
			? params.session[0]
			: params.session;
		console.log("[WhatTheyWearin] Fetching session:", sessionId);
		const sessionData = await fetchSessionData(sessionId);
		if (sessionData) {
			items = sessionData.items;
			metadata = sessionData.metadata;
		}
		mode = "session";
	}
	// Fall back to legacy base64 mode
	else if (params?.data) {
		console.log("[WhatTheyWearin] Using legacy base64 mode");
		items = decodeItems(params.data);
		mode = "legacy";
	}

	console.log("[WhatTheyWearin] decoded items:", items);
	console.log("[WhatTheyWearin] metadata:", metadata);

	// Detect shared points from items
	const sharedPoints = new Set(metadata?.sharedPoints || []);

	return (
		<div className="w-full h-screen p-3 text-foreground overflow-hidden">
			<Card className="border-border/60 bg-background/70 backdrop-blur shadow-sm h-full flex flex-col">
				<CardHeader className="py-3 shrink-0">
					<div className="flex items-center justify-between gap-2">
						<div className="flex items-baseline gap-2">
							<CardTitle className="text-base font-semibold">
								What They Wearin'
							</CardTitle>
							<Badge variant="outline" className="text-[10px]">
								HUD
							</Badge>
						</div>
						{metadata?.freeSlots !== undefined && (
							<Badge variant="secondary" className="text-[10px]">
								{metadata.freeSlots} free slot{metadata.freeSlots !== 1 ? "s" : ""}
							</Badge>
						)}
					</div>
				</CardHeader>
				<CardContent className="pt-0 flex-1 overflow-hidden flex flex-col">
					{!items || items.length === 0 ? (
						<div className="text-sm text-muted-foreground">
							{mode === "session" && (
								<>Session not found or expired. Touch the HUD to refresh.</>
							)}
							{mode === "legacy" && (
								<>
									No data received. Ensure your HUD is active and the prim media
									URL was set with a data payload.
								</>
							)}
							{mode === "none" && (
								<>No session or data provided. Touch the HUD to begin.</>
							)}
						</div>
					) : (
						<>
							<ScrollArea className="flex-1 pr-2">
								<ul className="grid gap-2 pb-2">
									{items.map((it, idx) => {
										const isShared =
											typeof it.point === "number" &&
											sharedPoints.has(it.point);
										return (
											<li
												key={(it.id ?? it.name ?? "item") + ":" + idx}
												className="rounded-lg border border-border/60 bg-card/60 hover:bg-card/80 transition-colors"
											>
												<div className="flex items-start gap-2 p-2.5">
													{/* Shared indicator */}
													<div className="shrink-0 text-sm pt-0.5">
														{isShared ? "🔁" : "☑️"}
													</div>

													<div className="min-w-0 flex-1">
														<div className="truncate font-medium text-sm">
															{it.name || "(unnamed)"}
														</div>

														{/* Attachment point */}
														{it.pointName && (
															<div className="text-[11px] text-muted-foreground/70">
																({it.pointName})
															</div>
														)}

														{/* Creator info */}
														{(it.creatorName || it.creator) && (
															<div className="truncate text-xs text-muted-foreground mt-0.5">
																[
																{it.profileUrl && it.creatorName ? (
																	<a
																		href={it.profileUrl}
																		className="hover:underline hover:text-foreground transition-colors"
																	>
																		{it.creatorName}
																	</a>
																) : (
																	it.creatorName || it.creator
																)}
																]
																{it.mpSearch && (
																	<>
																		{" "}
																		•{" "}
																		<a
																			href={it.mpSearch}
																			target="_blank"
																			rel="noopener noreferrer"
																			className="hover:underline hover:text-foreground transition-colors"
																		>
																			MP
																		</a>
																	</>
																)}
															</div>
														)}
													</div>
												</div>
											</li>
										);
									})}
								</ul>
							</ScrollArea>
							<div className="mt-2 text-[11px] text-muted-foreground/80 shrink-0">
								Showing {items.length} item{items.length !== 1 ? "s" : ""}. Touch
								the HUD to refresh.
							</div>
						</>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
