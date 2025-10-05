// Renders "What They Wearin'" data from a session or base64 JSON
// New mode: https://sanctumrp.net/wearing?session=SESSION_ID
// Legacy mode: https://sanctumrp.net/wearing?data=BASE64(JSON)

"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

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

// Legacy base64 decoding
function decodeItems(param?: string | null): WearingItem[] | null {
	if (!param) return null;
	try {
		const json = atob(param);
		const data = JSON.parse(json);
		if (Array.isArray(data)) return data as WearingItem[];
		if (Array.isArray((data as any)?.items))
			return (data as any).items as WearingItem[];
		return null;
	} catch {
		return null;
	}
}

export default function WhatTheyWearin() {
	const searchParams = useSearchParams();
	const [items, setItems] = useState<WearingItem[] | null>(null);
	const [metadata, setMetadata] = useState<SessionMetadata | undefined>();
	const [mode, setMode] = useState<"session" | "legacy" | "none">("none");
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const sessionId = searchParams.get("session");
		const dataParam = searchParams.get("data");

		if (sessionId) {
			// Fetch from session API
			setMode("session");
			setLoading(true);

			fetch(`/api/sl/wearing?session=${sessionId}`)
				.then((res) => {
					if (!res.ok) throw new Error("Failed to fetch session");
					return res.json();
				})
				.then((data) => {
					setItems(data.items || []);
					setMetadata(data.metadata);
					setLoading(false);
				})
				.catch((error) => {
					console.error("[WhatTheyWearin] Error:", error);
					setItems([]);
					setLoading(false);
				});
		} else if (dataParam) {
			// Decode base64
			setMode("legacy");
			setItems(decodeItems(dataParam));
			setLoading(false);
		} else {
			setMode("none");
			setLoading(false);
		}
	}, [searchParams]);

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
					{loading ? (
						<div className="text-sm text-muted-foreground">Loading...</div>
					) : !items || items.length === 0 ? (
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
