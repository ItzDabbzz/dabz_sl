"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Check, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Category type used by the marketplace explorer.
 */
export type Category = { id: string; primary: string; sub: string };

/**
 * Props for the CategoryPicker component.
 *
 * A light, performance-focused inline picker that:
 * - shows selected category badges
 * - opens a searchable popover
 * - saves changes optimistically (debounced) via onSave
 */
export interface CategoryPickerProps {
    /** Item id this picker edits categories for */
    itemId: string;
    /** All categories available for selection */
    categories: Category[];
    /** Whether categories have finished loading */
    catsLoaded: boolean;
    /** Currently selected category IDs for this item */
    selectedCategoryIds?: string[];
    /** Label resolver for a category id */
    labelFor: (id: string) => string;
    /** Ensure categories are loaded before interacting */
    onEnsureCatsLoaded: () => void;
    /** Ensure this item's categories are loaded before interacting */
    onEnsureItemCats: (itemId: string) => void;
    /** Persist new selection for the item */
    onSave: (itemId: string, finalIds: string[]) => Promise<void>;
}

/**
 * Small, reusable, memo-friendly category picker used inside each row.
 */
export default function CategoryPicker({
    itemId,
    categories,
    catsLoaded,
    selectedCategoryIds,
    labelFor,
    onEnsureCatsLoaded,
    onEnsureItemCats,
    onSave,
}: CategoryPickerProps) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState<string[] | null>(null);
    const [saving, setSaving] = useState(false);
    const saveDebounceRef = useRef<number | null>(null);
    const draftRef = useRef<string[]>([]);
    const saveSeqRef = useRef(0);

    const selected = draft ?? selectedCategoryIds ?? [];
    const nothingLoaded = !catsLoaded || selectedCategoryIds === undefined;

    // When opened, ensure data is present and seed local draft
    useEffect(() => {
        if (open) {
            if (!catsLoaded) onEnsureCatsLoaded();
            if (selectedCategoryIds === undefined) onEnsureItemCats(itemId);
            const base = selectedCategoryIds ?? [];
            setDraft(base);
            draftRef.current = base;
        } else {
            setDraft(null);
            draftRef.current = [];
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const scheduleSave = () => {
        if (saveDebounceRef.current)
            window.clearTimeout(saveDebounceRef.current);
        saveDebounceRef.current = window.setTimeout(() => {
            const before = selectedCategoryIds ?? [];
            const after = draftRef.current;
            const changed =
                before.length !== after.length ||
                before.some((b) => !after.includes(b));
            if (changed) void save(after);
        }, 400);
    };

    const toggle = (id: string) => {
        setDraft((d) => {
            const base = (d ?? selected).slice();
            const next = base.includes(id)
                ? base.filter((x) => x !== id)
                : [...base, id];
            draftRef.current = next;
            return next;
        });
        scheduleSave();
    };

    const save = async (finalIds: string[]) => {
        const seq = ++saveSeqRef.current;
        try {
            setSaving(true);
            await onSave(itemId, finalIds);
        } finally {
            if (seq === saveSeqRef.current) setSaving(false);
        }
    };

    const onOpenChange = (o: boolean) => {
        if (open && !o) {
            if (saveDebounceRef.current) {
                window.clearTimeout(saveDebounceRef.current);
                saveDebounceRef.current = null;
            }
            const before = selectedCategoryIds ?? [];
            const after = draftRef.current;
            const changed =
                before.length !== after.length ||
                before.some((b) => !after.includes(b));
            if (changed) void save(after);
        }
        setOpen(o);
    };

    return (
        <div className="space-y-1">
            <div className="flex flex-wrap gap-1 min-h-[1.25rem]">
                {selected.length ? (
                    selected.map((id) => (
                        <Badge
                            key={id}
                            variant="secondary"
                            title={labelFor(id)}
                        >
                            {labelFor(id)}
                        </Badge>
                    ))
                ) : nothingLoaded ? (
                    <span className="text-xs text-muted-foreground">
                        Loading…
                    </span>
                ) : (
                    <span className="text-xs text-muted-foreground">None</span>
                )}
            </div>
            <Popover open={open} onOpenChange={onOpenChange}>
                <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 px-2">
                        {saving ? (
                            <span className="inline-flex items-center">
                                <RefreshCw className="mr-1 h-3 w-3 animate-spin" />{" "}
                                Saving…
                            </span>
                        ) : (
                            "Manage"
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0">
                    <Command>
                        <CommandInput placeholder="Search categories…" />
                        <CommandList>
                            <CommandEmpty>No results.</CommandEmpty>
                            <CommandGroup heading="Categories">
                                {categories.map((c) => (
                                    <CommandItem
                                        key={c.id}
                                        value={`${c.primary} ${c.sub}`}
                                        onSelect={() => toggle(c.id)}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                selected.includes(c.id)
                                                    ? "opacity-100"
                                                    : "opacity-0",
                                            )}
                                        />
                                        {c.primary} › {c.sub}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
}
