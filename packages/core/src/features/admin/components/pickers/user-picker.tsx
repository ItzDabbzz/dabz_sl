"use client";
import { useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { useSession } from "@/features/auth/client";

/**
 * UserPicker
 * - Freeform user search with local options supplied via props
 * - Renders hidden input with selected user id(s), comma-separated
 * - Supports multi-select; pairs well with a small list preview
 */
export function UserPicker({
    name = "userIds",
    options = [],
    label = "Add users",
    placeholder = "Search users...",
    includeSelf = true,
    defaultToSelf = false,
    onSelected,
    defaultUserIds = [],
}: {
    name?: string;
    options?: Array<{
        id: string;
        name?: string | null;
        email?: string | null;
        image?: string | null;
    }>;
    label?: string;
    placeholder?: string;
    includeSelf?: boolean;
    defaultToSelf?: boolean;
    onSelected?: (user: {
        id: string;
        name?: string | null;
        email?: string | null;
        image?: string | null;
    }) => void;
    defaultUserIds?: string[];
}) {
    const { data: currentUser } = useSession();
    const me = currentUser?.user;

    const [query, setQuery] = useState("");
    const [selected, setSelected] = useState<Array<{
        id: string;
        name?: string | null;
        email?: string | null;
        image?: string | null;
    }>>([]);

    const mergedOptions = useMemo(() => {
        const list = [...options];
        if (includeSelf && me && !list.find((u) => u.id === me.id)) {
            list.unshift({
                id: me.id,
                name: me.name ?? null,
                email: me.email ?? null,
                image: (me as any).image ?? null,
            });
        }
        return list;
    }, [options, includeSelf, me?.id, me?.name, me?.email, (me as any)?.image]);

    const filtered = useMemo(() => {
        const q = query.toLowerCase();
        return mergedOptions.filter(
            (u) =>
                (u.name || "").toLowerCase().includes(q) ||
                (u.email || "").toLowerCase().includes(q) ||
                u.id.toLowerCase().includes(q),
        );
    }, [query, mergedOptions]);

    // Preselect provided default user IDs
    useEffect(() => {
        if (!defaultUserIds || defaultUserIds.length === 0) return;
        setSelected((prev) => {
            const prevIds = new Set(prev.map((u) => u.id));
            const toAdd = defaultUserIds
                .filter((id) => !!id && !prevIds.has(id))
                .map((id) => ({ id } as const));
            return toAdd.length ? [...prev, ...toAdd] : prev;
        });
    }, [defaultUserIds?.join(",")]);

    // Default to self selection if requested
    useEffect(() => {
        if (defaultToSelf && me && !selected.find((u) => u.id === me.id)) {
            setSelected((prev) => [
                {
                    id: me.id,
                    name: me.name ?? null,
                    email: me.email ?? null,
                    image: (me as any).image ?? null,
                },
                ...prev,
            ]);
        }
    }, [defaultToSelf, me?.id]);

    // Notify per-toggle for backward compatibility
    useEffect(() => {
        // no-op here; onSelected is invoked on toggle below
    }, [selected]);

    const isSelected = (id: string) => selected.some((s) => s.id === id);
    const toggle = (user: { id: string; name?: string | null; email?: string | null; image?: string | null }) => {
        setSelected((prev) => {
            const exists = prev.some((s) => s.id === user.id);
            const next = exists ? prev.filter((s) => s.id !== user.id) : [...prev, user];
            if (onSelected) onSelected(user);
            return next;
        });
    };

    return (
        <div className="grid gap-2">
            <label className="text-xs text-muted-foreground">{label}</label>
            <div className="rounded border">
                <Command>
                    <CommandInput
                        placeholder={placeholder}
                        value={query}
                        onValueChange={setQuery}
                    />
                    <CommandList>
                        <CommandEmpty>No results.</CommandEmpty>
                        <CommandGroup heading="Users">
                            {filtered.map((u) => (
                                <CommandItem
                                    key={u.id}
                                    value={u.name || u.email || u.id}
                                    onSelect={() => toggle(u)}
                                    className="flex items-center justify-between gap-2"
                                >
                                    <div className="flex items-center gap-2">
                                        <Avatar className="h-5 w-5">
                                            <AvatarImage src={u.image || undefined} />
                                            <AvatarFallback>
                                                {(u.name || u.email || "?")
                                                    .substring(0, 2)
                                                    .toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="text-sm">
                                            <div>{u.name || u.email || u.id}</div>
                                            {u.email && (
                                                <div className="text-xs text-muted-foreground">{u.email}</div>
                                            )}
                                        </div>
                                    </div>
                                    {isSelected(u.id) && (
                                        <Badge className="h-5 px-1 text-[10px]" variant="secondary">
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
                    {selected.map((u) => (
                        <button
                            type="button"
                            key={u.id}
                            onClick={() =>
                                setSelected((prev) => prev.filter((x) => x.id !== u.id))
                            }
                            className="group"
                            title="Remove"
                        >
                            <Badge className="h-6 gap-1 px-2 text-[11px] group-hover:line-through" variant="secondary">
                                <Avatar className="h-4 w-4">
                                    <AvatarImage src={u.image || undefined} />
                                    <AvatarFallback>
                                        {(u.name || u.email || u.id || "?").toString().substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                {u.name || u.email || u.id}
                            </Badge>
                        </button>
                    ))}
                </div>
            )}

            <input type="hidden" name={name} value={selected.map((u) => u.id).join(",")} />
        </div>
    );
}

export default UserPicker;
