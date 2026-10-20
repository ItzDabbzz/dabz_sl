"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ChevronDown, ChevronRight, ImageIcon, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import PathPicker from "./PathPicker";
import GroupItems from "./GroupItems";
import { pathLabel } from "@/features/marketplace/shared/category-path";
import type { ScrapedItem } from "../lib/types";

/** Props for {@link PathGroupRow}. */
export interface PathGroupRowProps {
    /** The marketplace's own path for this group. */
    marketplacePath: string[];
    /** The items in this group. */
    items: ScrapedItem[];
    /** The category paths assigned to this group. */
    value: string[][];
    /** Called with the group's new category paths. */
    onChange: (next: string[][]) => void;
    /** Every category path that exists. */
    existing: string[][];
    /** Whether the assignment came from the suggestion. */
    suggested: boolean;
    /** Per-item overrides, keyed by item URL. */
    overrides: Record<string, string[][]>;
    /** Set an item's override, or clear it with null. */
    onOverride: (url: string, value: string[][] | null) => void;
    /** Disable the controls. */
    disabled?: boolean;
}

/**
 * One row in the category matching list.
 *
 * The unit here is a marketplace category path and how many items share it —
 * not a single item. A store of 2,000 items collapses into a few dozen of
 * these, which is the difference between a few dozen decisions and 2,000.
 *
 * The items themselves are one click away: the row expands to show exactly
 * what is in the group, so the grouping never hides what is being imported.
 */
export default function PathGroupRow({
    marketplacePath,
    items,
    value,
    onChange,
    existing,
    suggested,
    overrides,
    onOverride,
    disabled,
}: PathGroupRowProps) {
    const [open, setOpen] = useState(false);
    const label = pathLabel(marketplacePath);
    const count = items.length;

    const sample = useMemo(() => items.slice(0, 3), [items]);
    const overrideCount = useMemo(
        () => Object.keys(overrides).length,
        [overrides],
    );

    return (
        <div className="border-b border-border/60 last:border-b-0 hover:bg-accent/20">
            <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-start sm:gap-4">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="mt-0.5 h-6 w-6 shrink-0"
                        aria-expanded={open}
                        aria-label={open ? "Hide items" : "Show items"}
                        onClick={() => setOpen((o) => !o)}
                    >
                        {open ? (
                            <ChevronDown className="h-4 w-4" />
                        ) : (
                            <ChevronRight className="h-4 w-4" />
                        )}
                    </Button>

                    <div className="flex -space-x-2 shrink-0">
                        {sample.map((item, index) =>
                            item.images?.[0] ? (
                                <Image
                                    key={`${item.url}-${index}`}
                                    src={item.images[0]}
                                    alt=""
                                    width={40}
                                    height={40}
                                    sizes="40px"
                                    className="h-10 w-10 rounded-md border-2 border-card object-cover"
                                />
                            ) : (
                                <span
                                    key={`${item.url}-${index}`}
                                    className="flex h-10 w-10 items-center justify-center rounded-md border-2 border-card bg-muted"
                                >
                                    <ImageIcon
                                        className="h-4 w-4 text-muted-foreground/60"
                                        aria-hidden
                                    />
                                </span>
                            ),
                        )}
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="truncate text-sm font-medium">
                                        {label}
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent>{label}</TooltipContent>
                            </Tooltip>
                            <Badge variant="outline" className="shrink-0">
                                {count.toLocaleString()} item
                                {count === 1 ? "" : "s"}
                            </Badge>
                            {suggested && (
                                <Badge
                                    variant="secondary"
                                    className="shrink-0 gap-1"
                                >
                                    <Layers className="h-3 w-3" aria-hidden />
                                    suggested
                                </Badge>
                            )}
                            {overrideCount > 0 && (
                                <Badge
                                    variant="outline"
                                    className="shrink-0 border-amber-500/60 text-amber-600 dark:text-amber-400"
                                >
                                    {overrideCount} moved
                                </Badge>
                            )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            Marketplace category
                        </p>
                    </div>
                </div>

                <div className="min-w-0 sm:w-[22rem] sm:shrink-0">
                    <PathPicker
                        existing={existing}
                        value={value}
                        onChange={onChange}
                        triggerLabel="Set category"
                        disabled={disabled}
                    />
                </div>
            </div>

            {open && (
                <div className="border-t border-border/60 bg-muted/20 pl-9">
                    <GroupItems
                        items={items}
                        groupValue={value}
                        overrides={overrides}
                        onOverride={onOverride}
                        existing={existing}
                        disabled={disabled}
                    />
                </div>
            )}
        </div>
    );
}
