// Renders "What They Wearin'" data passed via base64 JSON in the `data` search param.
// Example URL (HUD sets this as prim media):
// https://sanctumrp.net/wearing?data=BASE64(JSON)

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface WearingItem {
	id?: string;
	name: string;
	point?: string | number;
	creator?: string;
}

export const dynamic = "force-dynamic";

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

export default function WhatTheyWearin({
	searchParams,
}: {
	searchParams?: Record<string, string | string[]>;
}) {
	const items = decodeItems(searchParams?.data);

	return (
		<div className="w-full p-3 text-foreground">
			<Card className="border-border/60 bg-background/70 backdrop-blur shadow-sm">
				<CardHeader className="py-3">
					<div className="flex items-baseline gap-2">
						<CardTitle className="text-base font-semibold">
							What They Wearin'
						</CardTitle>
						<Badge variant="outline" className="text-[10px]">HUD</Badge>
					</div>
				</CardHeader>
				<CardContent className="pt-0">
					{!items || items.length === 0 ? (
						<div className="text-sm text-muted-foreground">
							No data received. Ensure your HUD is active and the prim media URL
							was set with a data payload.
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
												<div className="min-w-0">
													<div className="truncate font-medium">
														{it.name || "(unnamed)"}
													</div>
													<div className="truncate text-xs text-muted-foreground">
														{it.creator ? `by ${it.creator}` : ""}
													</div>
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
								Tip: Touch the HUD to refresh. Large outfits may be truncated
								to fit URL limits.
							</div>
						</>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
