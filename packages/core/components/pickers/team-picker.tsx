"use client";
import { useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { useActiveOrganization } from "@/lib/auth-client";

/**
 * TeamPicker
 * - Command-style searchable team selector for a given orgId
 * - Uses active organization teams when orgId matches active org
 * - Supports multi-select and renders selected as small badges
 * - Can optionally render a hidden input with comma-separated team IDs
 */
export function TeamPicker({
    orgId,
    nameTeams = "teamIds",
    label = "Teams",
    defaultTeamIds = [],
    selectedTeamIds,
    onChange,
    includeHiddenInput = true,
}: {
    orgId?: string | null;
    nameTeams?: string;
    label?: string;
    defaultTeamIds?: string[];
    selectedTeamIds?: string[];
    onChange?: (ids: string[]) => void;
    includeHiddenInput?: boolean;
}) {
    const activeOrg = useActiveOrganization();
    const [internalSelected, setInternalSelected] =
        useState<string[]>(defaultTeamIds);

    const selected = selectedTeamIds ?? internalSelected;
    const setSelected = (ids: string[]) => {
        if (onChange) onChange(ids);
        setInternalSelected(ids);
    };

    // Helper to update selection based on previous value
    const updateSelected = (updater: (prev: string[]) => string[]) => {
        if (selectedTeamIds) {
            // Controlled: compute from controlled value and emit
            const next = updater(selectedTeamIds);
            if (onChange) onChange(next);
        } else {
            // Uncontrolled: update internal state and emit
            setInternalSelected((prev) => {
                const next = updater(prev);
                if (onChange) onChange(next);
                return next;
            });
        }
    };

    const teams = useMemo(() => {
        if (!orgId) return [] as Array<{ id: string; name?: string | null }>;
        if (activeOrg.data?.id !== orgId)
            return [] as Array<{ id: string; name?: string | null }>;
        const t = (activeOrg.data as any)?.teams as
            | Array<{ id: string; name?: string | null }>
            | undefined;
        return Array.isArray(t) ? t : [];
    }, [orgId, activeOrg.data]);

    // Ensure selections stay valid when teams list changes
    useEffect(() => {
        if (teams.length > 0) {
            updateSelected((prev) =>
                prev.filter((id) => teams.some((t) => t.id === id)),
            );
        }
    }, [teams]);

    const toggle = (id: string) => {
        updateSelected((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        );
    };

    return (
        <div className="grid gap-2">
            <label className="text-xs text-muted-foreground">{label}</label>
            <div className="rounded border">
                <Command>
                    <CommandInput placeholder="Search teams..." />
                    <CommandList>
                        <CommandEmpty>No teams.</CommandEmpty>
                        <CommandGroup heading="Teams">
                            {teams.map((t) => (
                                <CommandItem
                                    key={t.id}
                                    value={t.name || t.id}
                                    onSelect={() => toggle(t.id)}
                                    className="flex items-center justify-between gap-2"
                                >
                                    <div className="flex items-center gap-2">
                                        <Avatar className="h-5 w-5">
                                            <AvatarFallback>
                                                {(t.name || t.id)
                                                    .substring(0, 2)
                                                    .toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="text-sm">
                                            {t.name || t.id}
                                        </span>
                                    </div>
                                    {selected.includes(t.id) && (
                                        <Badge
                                            className="h-5 px-1 text-[10px]"
                                            variant="secondary"
                                        >
                                            Selected
                                        </Badge>
                                    )}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </div>

            {selected.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {selected.map((id) => (
                        <Badge
                            key={id}
                            className="h-5 px-1 text-[10px]"
                            variant="secondary"
                        >
                            {id}
                        </Badge>
                    ))}
                </div>
            )}

            {includeHiddenInput && (
                <input
                    type="hidden"
                    name={nameTeams}
                    value={selected.join(",")}
                />
            )}

            {orgId && activeOrg.data?.id !== orgId && (
                <p className="text-xs text-muted-foreground">
                    Switch your active organization in profile to see team list.
                </p>
            )}
        </div>
    );
}

export default TeamPicker;
