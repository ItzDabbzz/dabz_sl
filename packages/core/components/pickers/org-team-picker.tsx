"use client";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { useListOrganizations, useActiveOrganization } from "@/lib/auth-client";
import { TeamPicker } from "@/components/pickers/team-picker";

/**
 * OrgTeamPicker (generalized)
 * - Organization search with Command menu and avatar fallback
 * - Multi-select organizations; emits comma-separated IDs
 * - If exactly one selected org is the active org, shows teams via TeamPicker (when preferTeamPicker)
 * - Else, allows manual comma-separated team IDs
 * - Emits hidden inputs nameOrg/nameTeams for form posts
 */
export function OrgTeamPicker({
    nameOrg = "orgIds",
    nameTeams = "teamIds",
    defaultOrgId,
    defaultOrgIds,
    defaultTeamIds = [],
    labelOrg = "Organizations",
    labelTeams = "Teams",
    preferTeamPicker = true,
}: {
    nameOrg?: string;
    nameTeams?: string;
    defaultOrgId?: string | null;
    defaultOrgIds?: string[];
    defaultTeamIds?: string[];
    labelOrg?: string;
    labelTeams?: string;
    preferTeamPicker?: boolean;
}) {
    const { data: orgs } = useListOrganizations();
    const activeOrg = useActiveOrganization();

    const initialOrgIds = useMemo(() => {
        if (defaultOrgIds && defaultOrgIds.length)
            return defaultOrgIds.filter(Boolean);
        if (defaultOrgId) return [defaultOrgId].filter(Boolean) as string[];
        return [] as string[];
    }, [defaultOrgIds, defaultOrgId]);

    const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>(initialOrgIds);
    const [selectedTeams, setSelectedTeams] = useState<string[]>(defaultTeamIds);
    const [manualTeams, setManualTeams] = useState<string>(defaultTeamIds.join(", "));

    // Keep initialOrgIds in sync when props change (rare)
    useEffect(() => {
        setSelectedOrgIds(initialOrgIds);
    }, [initialOrgIds.join(",")]);

    const orgMap = useMemo(() => {
        const m = new Map<string, { id: string; name?: string | null; slug?: string | null }>();
        (orgs || []).forEach((o: any) => m.set(o.id, { id: o.id, name: o.name, slug: o.slug }));
        return m;
    }, [orgs]);

    const singleSelectedActiveOrgId = useMemo(() => {
        if (selectedOrgIds.length !== 1) return null;
        const id = selectedOrgIds[0];
        return activeOrg.data?.id === id ? id : null;
    }, [selectedOrgIds, activeOrg.data]);

    const teamsForOrg = useMemo(() => {
        if (!singleSelectedActiveOrgId) return [] as any[];
        const t = (activeOrg.data as any)?.teams as any[] | undefined;
        return Array.isArray(t) ? t : [];
    }, [singleSelectedActiveOrgId, activeOrg.data]);

    // Ensure team selections stay valid when team list changes
    useEffect(() => {
        if (teamsForOrg.length > 0) {
            setSelectedTeams((prev) => prev.filter((id) => teamsForOrg.some((t: any) => t.id === id)));
        }
    }, [teamsForOrg]);

    // When we cannot show team list (no active org or multiple orgs), use manual text as source of truth
    useEffect(() => {
        if (teamsForOrg.length === 0) {
            const parsed = manualTeams
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
            setSelectedTeams(parsed);
        }
    }, [manualTeams, teamsForOrg.length]);

    const toggleOrg = (id: string) => {
        setSelectedOrgIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        );
    };

    return (
        <div className="grid gap-3">
            <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{labelOrg}</label>
                <div className="rounded border">
                    <Command>
                        <CommandInput placeholder="Search organizations..." />
                        <CommandList>
                            <CommandEmpty>No results.</CommandEmpty>
                            <CommandGroup heading="Organizations">
                                {(orgs || []).map((o: any) => {
                                    const selected = selectedOrgIds.includes(o.id);
                                    return (
                                        <CommandItem
                                            key={o.id}
                                            value={o.name || o.slug || o.id}
                                            onSelect={() => toggleOrg(o.id)}
                                            className="flex items-center justify-between gap-2"
                                        >
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-5 w-5">
                                                    <AvatarFallback>
                                                        {(o.name || o.slug || "?")
                                                            .substring(0, 2)
                                                            .toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span className="text-sm">{o.name || o.slug || o.id}</span>
                                            </div>
                                            {selected && (
                                                <span className="text-[10px] rounded bg-muted px-1 py-0.5">
                                                    Selected
                                                </span>
                                            )}
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </div>
                {selectedOrgIds.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                        {selectedOrgIds.map((id) => {
                            const o = orgMap.get(id);
                            const label = o?.name || (o as any)?.slug || id;
                            return (
                                <span key={id} className="text-[11px] rounded bg-muted px-2 py-1">
                                    {label}
                                </span>
                            );
                        })}
                    </div>
                )}
            </div>

            {singleSelectedActiveOrgId && teamsForOrg.length > 0 && preferTeamPicker && (
                <TeamPicker
                    orgId={singleSelectedActiveOrgId}
                    nameTeams={nameTeams}
                    label={labelTeams}
                    defaultTeamIds={defaultTeamIds}
                    selectedTeamIds={selectedTeams}
                    onChange={setSelectedTeams}
                    includeHiddenInput={false}
                />
            )}

            {singleSelectedActiveOrgId && teamsForOrg.length > 0 && !preferTeamPicker && (
                <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">{labelTeams}</div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {teamsForOrg.map((t: any) => {
                            const checked = selectedTeams.includes(t.id);
                            return (
                                <label key={t.id} className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4"
                                        checked={checked}
                                        onChange={(e) => {
                                            setSelectedTeams((prev) =>
                                                e.target.checked
                                                    ? Array.from(new Set([...prev, t.id]))
                                                    : prev.filter((id) => id !== t.id),
                                            );
                                        }}
                                    />
                                    <span>{t.name || t.id}</span>
                                </label>
                            );
                        })}
                    </div>
                    <p className="text-xs text-muted-foreground">Teams from active organization.</p>
                </div>
            )}

            {!singleSelectedActiveOrgId && (
                <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">
                        {labelTeams} (IDs, comma-separated)
                    </label>
                    <Input
                        value={manualTeams}
                        onChange={(e) => setManualTeams(e.target.value)}
                        placeholder="team_123, team_abc"
                    />
                    <p className="text-xs text-muted-foreground">
                        Select exactly one active organization to view team list.
                    </p>
                </div>
            )}

            <input type="hidden" name={nameOrg} value={selectedOrgIds.join(",")} />
            <input type="hidden" name={nameTeams} value={selectedTeams.join(",")} />
        </div>
    );
}

export default OrgTeamPicker;
