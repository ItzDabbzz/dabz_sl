"use client";

import { useMemo, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    normalizePath,
    pathKey,
    pathLabel,
} from "@/features/marketplace/shared/category-path";
import { cn } from "@/lib/utils";

/** Props for {@link PathPicker}. */
export interface PathPickerProps {
    /** Every category path that exists, as arrays of segments. */
    existing: string[][];
    /** The paths currently selected. */
    value: string[][];
    /** Called with the new set whenever it changes. */
    onChange: (next: string[][]) => void;
    /** Label for the trigger button. */
    triggerLabel?: string;
    /** Show the trigger as an icon-only button. */
    compact?: boolean;
    /** Disable the control. */
    disabled?: boolean;
    /**
     * Close the picker after a path is chosen.
     *
     * Right for a bulk action, where one pick is the whole gesture. Left off
     * for a per-item picker, where choosing several is normal.
     */
    closeOnSelect?: boolean;
    /** Called with the path that was just chosen. */
    onApplied?: (path: string[]) => void;
    /** Hide the "no categories assigned" line. */
    hideEmptyHint?: boolean;
}

/**
 * Split a typed path into segments.
 *
 * Accepts " > ", " / " and " › " as separators, so a path can be typed the
 * way it is displayed.
 */
export function parsePathInput(text: string): string[] {
    return normalizePath(
        text
            .split(/\s*(?:>|›|\/)\s*/)
            .map((s) => s.trim())
            .filter(Boolean),
    );
}

/**
 * Category assignment: current values as removable chips, plus a searchable
 * picker for adding more.
 *
 * The old importer rendered one button per primary category on every row,
 * which for a store with dozens of primaries meant a wall of buttons and no
 * way to undo a mistake. Chips with an explicit remove action, and a
 * searchable picker, fix both.
 *
 * A path can also be created from scratch — the tree here is meant to go
 * deeper than the marketplace's own, so it cannot be limited to what already
 * exists.
 */
export default function PathPicker({
    existing,
    value,
    onChange,
    triggerLabel = "Add",
    compact = false,
    disabled,
    closeOnSelect = false,
    onApplied,
    hideEmptyHint = false,
}: PathPickerProps) {
    const [open, setOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [draft, setDraft] = useState("");

    const selectedKeys = useMemo(
        () => new Set(value.map((p) => pathKey(p))),
        [value],
    );

    // Group the existing paths by their first segment, so the picker reads as
    // a tree rather than a flat list.
    const grouped = useMemo(() => {
        const map = new Map<string, string[][]>();
        for (const path of existing) {
            const segments = normalizePath(path);
            if (!segments.length) continue;
            const root = segments[0]!;
            const list = map.get(root) ?? [];
            list.push(segments);
            map.set(root, list);
        }
        for (const list of map.values()) {
            list.sort((a, b) => pathLabel(a).localeCompare(pathLabel(b)));
        }
        return Array.from(map.entries()).sort((a, b) =>
            a[0].localeCompare(b[0]),
        );
    }, [existing]);

    const draftPath = useMemo(() => parsePathInput(draft), [draft]);
    const draftExists = draftPath.length
        ? existing.some((p) => pathKey(p) === pathKey(draftPath))
        : false;
    // The tree's depth is unbounded, so a draft path is never too deep.

    const toggle = (path: string[]) => {
        const key = pathKey(path);
        const alreadyOn = selectedKeys.has(key);
        onChange(
            alreadyOn
                ? value.filter((p) => pathKey(p) !== key)
                : [...value, path],
        );
        if (!alreadyOn) {
            onApplied?.(path);
            if (closeOnSelect) setOpen(false);
        }
    };

    const remove = (path: string[]) => {
        onChange(value.filter((p) => pathKey(p) !== pathKey(path)));
    };

    const createDraft = () => {
        if (!draftPath.length) return;
        toggle(draftPath);
        setDraft("");
        setCreating(false);
    };

    return (
        <div className="space-y-1.5">
            {value.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                    {value.map((path) => (
                        <Badge
                            key={pathKey(path)}
                            variant="secondary"
                            className="max-w-full gap-1 whitespace-nowrap py-0.5 pl-2 pr-1"
                        >
                            <span className="truncate" title={pathLabel(path)}>
                                {pathLabel(path)}
                            </span>
                            <button
                                type="button"
                                onClick={() => remove(path)}
                                disabled={disabled}
                                aria-label={`Remove category ${pathLabel(path)}`}
                                className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                            >
                                <X className="h-3 w-3" aria-hidden />
                            </button>
                        </Badge>
                    ))}
                </div>
            ) : (
                !hideEmptyHint && (
                    <p className="text-xs text-muted-foreground">
                        No categories assigned
                    </p>
                )
            )}

            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disabled}
                        className={cn("h-7", compact ? "px-2" : "px-2.5")}
                    >
                        {!compact && (
                            <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
                        )}
                        {compact ? (
                            <span className="sr-only">{triggerLabel}</span>
                        ) : (
                            triggerLabel
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[340px] p-0" align="start">
                    {creating ? (
                        <div className="space-y-2 p-3">
                            <label
                                htmlFor="new-category-path"
                                className="text-xs font-medium"
                            >
                                New category path
                            </label>
                            <Input
                                id="new-category-path"
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        createDraft();
                                    }
                                    if (e.key === "Escape") setCreating(false);
                                }}
                                placeholder="Apparel > Women's > Boots"
                                autoFocus
                            />
                            {draftPath.length > 0 && (
                                <p className="text-xs text-muted-foreground">
                                    Will create{" "}
                                    <span className="text-foreground">
                                        {pathLabel(draftPath)}
                                    </span>
                                    {draftExists ? " (already exists)" : ""}
                                </p>
                            )}
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    onClick={createDraft}
                                    disabled={!draftPath.length}
                                >
                                    Create
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                        setCreating(false);
                                        setDraft("");
                                    }}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <Command>
                            <CommandInput placeholder="Search categories…" />
                            <CommandList>
                                <CommandEmpty>
                                    No category found.
                                </CommandEmpty>
                                {grouped.map(([root, paths]) => (
                                    <CommandGroup key={root} heading={root}>
                                        {paths.map((path) => {
                                            const key = pathKey(path);
                                            const isOn = selectedKeys.has(key);
                                            return (
                                                <CommandItem
                                                    key={key}
                                                    value={pathLabel(path)}
                                                    onSelect={() =>
                                                        toggle(path)
                                                    }
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            isOn
                                                                ? "opacity-100"
                                                                : "opacity-0",
                                                        )}
                                                        aria-hidden
                                                    />
                                                    <span className="truncate">
                                                        {pathLabel(path)}
                                                    </span>
                                                </CommandItem>
                                            );
                                        })}
                                    </CommandGroup>
                                ))}
                                <CommandGroup heading="New">
                                    <CommandItem
                                        value="__create__"
                                        onSelect={() => {
                                            setCreating(true);
                                            setDraft("");
                                        }}
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Create a new category path
                                    </CommandItem>
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    )}
                </PopoverContent>
            </Popover>
        </div>
    );
}
