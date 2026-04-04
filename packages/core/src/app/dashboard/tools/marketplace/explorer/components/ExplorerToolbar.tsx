"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { ChevronsUpDown, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type Category = { id: string; primary: string; sub: string };

/**
 * Options the toolbar allows the user to control.
 */
export interface ToolbarState {
    q: string;
    categoryId: string;
    sort: "most" | "least";
    justImported: boolean;
    onlyUncategorized: boolean;
    sinceMinutes: number | null;
}

export interface ExplorerToolbarProps {
    categories: Category[];
    state: ToolbarState;
    loading: boolean;
    lastImportedIds: string[];
    onChange: (next: Partial<ToolbarState>) => void;
    onRefresh: () => void;
    /** Trigger XLSX export */
    onExport?: () => void;
    /** Whether export should be disabled */
    exportDisabled?: boolean;
}

/**
 * Top toolbar: category combobox, search, sort, quick filters, export action state.
 */
export default function ExplorerToolbar({
    categories,
    state,
    loading,
    lastImportedIds,
    onChange,
    onRefresh,
    onExport,
    exportDisabled,
}: ExplorerToolbarProps) {
    const [catOpen, setCatOpen] = useState(false);
    const commandRef = useRef<HTMLDivElement | null>(null);

    // keyboard shortcut focus
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setCatOpen(true);
                setTimeout(() => {
                    commandRef.current
                        ?.querySelector<HTMLInputElement>("[cmdk-input]")
                        ?.focus();
                }, 50);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    const primaries = useMemo(
        () => Array.from(new Set(categories.map((c) => c.primary))).sort(),
        [categories],
    );
    const subsFor = (p: string) =>
        categories
            .filter((c) => c.primary === p)
            .map((c) => ({ id: c.id, sub: c.sub }));
    const selectedCategoryLabel = useMemo(() => {
        if (!state.categoryId) return "All Categories";
        const cat = categories.find((c) => c.id === state.categoryId);
        return cat ? `${cat.primary} › ${cat.sub}` : "All Categories";
    }, [state.categoryId, categories]);

    return (
        <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
                <Popover open={catOpen} onOpenChange={setCatOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={catOpen}
                            className="w-[260px] justify-between"
                            title="Open categories (Ctrl/Cmd + K)"
                        >
                            <span className="truncate">
                                {selectedCategoryLabel}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0">
                        <Command ref={commandRef}>
                            <CommandInput
                                placeholder="Search categories..."
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        const first =
                                            commandRef.current?.querySelector<HTMLElement>(
                                                "[cmdk-item]",
                                            );
                                        first?.click();
                                    }
                                }}
                            />
                            <CommandList>
                                <CommandEmpty>No category found.</CommandEmpty>
                                <CommandGroup heading="General">
                                    <CommandItem
                                        value="__all__"
                                        onSelect={() => {
                                            onChange({ categoryId: "" });
                                            setCatOpen(false);
                                        }}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                state.categoryId === ""
                                                    ? "opacity-100"
                                                    : "opacity-0",
                                            )}
                                        />
                                        All Categories
                                    </CommandItem>
                                </CommandGroup>
                                {primaries.map((p) => (
                                    <CommandGroup key={p} heading={p}>
                                        {subsFor(p).map((s) => (
                                            <CommandItem
                                                key={s.id}
                                                value={`${p} ${s.sub}`}
                                                onSelect={() => {
                                                    onChange({
                                                        categoryId: s.id,
                                                    });
                                                    setCatOpen(false);
                                                }}
                                            >
                                                <Check
                                                    className={cn(
                                                        "mr-2 h-4 w-4",
                                                        state.categoryId ===
                                                            s.id
                                                            ? "opacity-100"
                                                            : "opacity-0",
                                                    )}
                                                />
                                                {s.sub}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                ))}
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
                <div className="relative flex-1 min-w-[200px]">
                    <Input
                        className="h-9 pr-8"
                        placeholder="Search title or description"
                        value={state.q}
                        onChange={(e) => onChange({ q: e.target.value })}
                    />
                    {state.q && (
                        <button
                            type="button"
                            onClick={() => {
                                onChange({ q: "" });
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            aria-label="Clear search"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-2">
                {/* Sort dropdown */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="h-9">
                            Sort:{" "}
                            {state.sort === "most"
                                ? "Most rated"
                                : "Least rated"}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem
                            onClick={() => onChange({ sort: "most" })}
                        >
                            Most rated
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => onChange({ sort: "least" })}
                        >
                            Least rated
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                <Button
                    variant={state.justImported ? "default" : "outline"}
                    className="h-9"
                    disabled={!lastImportedIds.length}
                    title={
                        lastImportedIds.length
                            ? `Filter to last imported batch (${lastImportedIds.length})`
                            : "No recent import in this session"
                    }
                    onClick={() =>
                        onChange({ justImported: !state.justImported })
                    }
                >
                    Just imported
                </Button>
                <Button
                    variant={state.onlyUncategorized ? "default" : "outline"}
                    className="h-9"
                    onClick={() =>
                        onChange({
                            onlyUncategorized: !state.onlyUncategorized,
                        })
                    }
                >
                    Uncategorized
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="h-9">
                            Time:{" "}
                            {state.sinceMinutes
                                ? state.sinceMinutes >= 1440
                                    ? "24h"
                                    : state.sinceMinutes >= 60
                                      ? "1h"
                                      : `${state.sinceMinutes}m`
                                : "Any"}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem
                            onClick={() => onChange({ sinceMinutes: null })}
                        >
                            Any
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => onChange({ sinceMinutes: 10 })}
                        >
                            Last 10m
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => onChange({ sinceMinutes: 60 })}
                        >
                            Last 1h
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => onChange({ sinceMinutes: 1440 })}
                        >
                            Last 24h
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                {loading && <Badge variant="secondary">Loading…</Badge>}
                <Button variant="outline" onClick={onRefresh}>
                    Refresh
                </Button>
                {onExport && (
                    <Button
                        variant="outline"
                        onClick={onExport}
                        disabled={!!exportDisabled}
                    >
                        Export XLSX
                    </Button>
                )}
            </div>
        </div>
    );
}
