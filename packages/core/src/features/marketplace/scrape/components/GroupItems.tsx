"use client";

import Image from "next/image";
import { Virtuoso } from "react-virtuoso";
import { ImageIcon, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import PathPicker from "./PathPicker";
import type { ScrapedItem } from "../lib/types";

/** Props for {@link GroupItems}. */
export interface GroupItemsProps {
    /** The items in this group. */
    items: ScrapedItem[];
    /** The category paths the group as a whole assigns. */
    groupValue: string[][];
    /** Per-item overrides, keyed by item URL. */
    overrides: Record<string, string[][]>;
    /** Set an item's override, or clear it with null. */
    onOverride: (url: string, value: string[][] | null) => void;
    /** Every category path that exists. */
    existing: string[][];
    /** Disable the controls. */
    disabled?: boolean;
}

/**
 * The actual items in a group.
 *
 * The group is the unit of work, but the items are what the user is
 * importing, so they have to be visible: what they are, what they cost, and
 * whether one of them has been filed somewhere other than the rest of its
 * group.
 *
 * The list is virtualised because a single marketplace path can hold
 * hundreds of items.
 */
export default function GroupItems({
    items,
    groupValue,
    overrides,
    onOverride,
    existing,
    disabled,
}: GroupItemsProps) {
    return (
        <Virtuoso
            data={items}
            className="themed-scrollbar"
            // A scroller with no height of its own collapses to nothing, so
            // the height is set here rather than left to the parent.
            style={{ height: "min(24rem, 50vh)" }}
            overscan={60}
            itemContent={(_index, item) => {
                const url = item.url ?? "";
                const override = overrides[url];
                const isOverride = override !== undefined;
                const value = override ?? groupValue;

                return (
                    <div className="flex items-center gap-3 border-b border-border/40 px-3 py-2 last:border-b-0 hover:bg-accent/20">
                        {item.images?.[0] ? (
                            <Image
                                src={item.images[0]}
                                alt=""
                                width={32}
                                height={32}
                                sizes="32px"
                                className="h-8 w-8 shrink-0 rounded border object-cover"
                            />
                        ) : (
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded border bg-muted">
                                <ImageIcon
                                    className="h-4 w-4 text-muted-foreground/60"
                                    aria-hidden
                                />
                            </span>
                        )}

                        <div className="min-w-0 flex-1">
                            <div
                                className="truncate text-xs font-medium"
                                title={item.title}
                            >
                                {item.title || item.url}
                            </div>
                            <div className="truncate text-[11px] text-muted-foreground">
                                {item.price ? `L$ ${item.price}` : "—"}
                                {item.creator?.name
                                    ? ` · ${item.creator.name}`
                                    : ""}
                            </div>
                        </div>

                        {isOverride && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 shrink-0 gap-1 px-2 text-[11px] text-muted-foreground"
                                        disabled={disabled}
                                        onClick={() =>
                                            onOverride(url, null)
                                        }
                                    >
                                        <RotateCcw className="h-3 w-3" />
                                        Reset
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    Put this item back with the rest of its
                                    group
                                </TooltipContent>
                            </Tooltip>
                        )}

                        <div className="w-44 shrink-0">
                            <PathPicker
                                existing={existing}
                                value={value}
                                onChange={(next) =>
                                    onOverride(
                                        url,
                                        next.length ? next : null,
                                    )
                                }
                                triggerLabel={
                                    isOverride ? "Override" : "Set category"
                                }
                                disabled={disabled}
                            />
                        </div>
                    </div>
                );
            }}
        />
    );
}
