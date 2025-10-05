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
	creator?: string;
	creatorName?: string;
	mpSearch?: string;
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
async function fetchSessionItems(sessionId: string): Promise<WearingItem[] | null> {
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
		return data.items || null;
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
	let mode: "session" | "legacy" | "none" = "none";

	// Try session mode first
	if (params?.session) {
		const sessionId = Array.isArray(params.session)
			? params.session[0]
			: params.session;
		console.log("[WhatTheyWearin] Fetching session:", sessionId);
		items = await fetchSessionItems(sessionId);
		mode = "session";
	}
	// Fall back to legacy base64 mode
	else if (params?.data) {
		console.log("[WhatTheyWearin] Using legacy base64 mode");
		items = decodeItems(params.data);
		mode = "legacy";
	}

	console.log("[WhatTheyWearin] decoded items:", items);

	return (
		<div className="w-full p-3 text-foreground">
			<Card className="border-border/60 bg-background/70 backdrop-blur shadow-sm">
				<CardHeader className="py-3">
					<div className="flex items-baseline gap-2">
						<CardTitle className="text-base font-semibold">
							What They Wearin'
						</CardTitle>
						<Badge variant="outline" className="text-[10px]">
							HUD
						</Badge>
					</div>
				</CardHeader>
				<CardContent className="pt-0">
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
							<ScrollArea className="max-h-80 pr-2">
								<ul className="grid gap-2">
									{items.map((it, idx) => (
										<li
											key={(it.id ?? it.name ?? "item") + ":" + idx}
											className="rounded-lg border border-border/60 bg-card/60 hover:bg-card/80 transition-colors"
										>
											<div className="flex items-start justify-between gap-3 p-2.5">
												<div className="min-w-0 flex-1">
													<div className="truncate font-medium">
														{it.name || "(unnamed)"}
													</div>
													{(it.creatorName || it.creator) && (
														<div className="truncate text-xs text-muted-foreground">
															by{" "}
															{it.mpSearch && it.creatorName ? (
																<a
																	href={it.mpSearch}
																	target="_blank"
																	rel="noopener noreferrer"
																	className="hover:underline hover:text-foreground transition-colors"
																>
																	{it.creatorName}
																</a>
															) : (
																it.creatorName || it.creator
															)}
														</div>
													)}
												</div>
												<div className="shrink-0 text-xs text-muted-foreground">
													{it.point !== undefined && it.point !== null
														? `@ ${it.point}`
														: ""}
												</div>
											</div>
										</li>
									))}
								</ul>
							</ScrollArea>
							<div className="mt-2 text-[11px] text-muted-foreground/80">
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
