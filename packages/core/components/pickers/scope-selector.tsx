"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface ScopeOption {
  key: string;
  label?: string;
  group?: string;
  description?: string;
}

export interface ScopeSelectorProps {
  options: ScopeOption[];
  value?: string[];
  defaultValue?: string[];
  onChange?: (next: string[]) => void;
  disabled?: boolean;
  hideSearch?: boolean;
  className?: string;
}

export function ScopeSelector(props: ScopeSelectorProps) {
  const { options, value, defaultValue = [], onChange, disabled, hideSearch, className } = props;
  const [internal, setInternal] = React.useState<string[]>(defaultValue);
  const selected = (value ?? internal).slice().sort();
  const [query, setQuery] = React.useState("");

  const grouped = React.useMemo(() => {
    const groups = new Map<string, ScopeOption[]>();
    const normalized = options
      .slice()
      .sort((a, b) => (a.group || "").localeCompare(b.group || "") || (a.label || a.key).localeCompare(b.label || b.key));
    for (const opt of normalized) {
      const g = opt.group || "Other";
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(opt);
    }
    return groups;
  }, [options]);

  const filterMatch = (opt: ScopeOption) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      opt.key.toLowerCase().includes(q) ||
      (opt.label || "").toLowerCase().includes(q) ||
      (opt.description || "").toLowerCase().includes(q) ||
      (opt.group || "").toLowerCase().includes(q)
    );
  };

  const toggle = (k: string) => {
    if (disabled) return;
    const set = new Set(selected);
    // Star means all permissions: selecting it overrides others
    if (k === "*") {
      if (set.has("*")) set.delete("*");
      else {
        set.clear();
        set.add("*");
      }
      const nextStar = Array.from(set);
      if (onChange) onChange(nextStar);
      else setInternal(nextStar);
      return;
    }
    // If star is active, remove it when toggling granular scopes
    if (set.has("*") && k !== "*") set.delete("*");
    if (set.has(k)) set.delete(k);
    else set.add(k);
    const next = Array.from(set);
    if (onChange) onChange(next);
    else setInternal(next);
  };

  const setForGroup = (group: string, keys: string[], select: boolean) => {
    if (disabled) return;
    const set = new Set(selected);
    // Special-case: Global group with star
    if (group === "Global" && keys.includes("*")) {
      if (select) {
        set.clear();
        set.add("*");
      } else {
        set.delete("*");
      }
    } else {
      if (set.has("*")) set.delete("*");
      for (const k of keys) {
        if (select) set.add(k);
        else set.delete(k);
      }
    }
    const next = Array.from(set);
    if (onChange) onChange(next);
    else setInternal(next);
  };

  return (
    <TooltipProvider>
      <div className={cn("grid gap-2", className)}>
      {!hideSearch && (
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search scopes..."
          disabled={disabled}
        />)
      }
      <div className="space-y-3">
        {Array.from(grouped.entries()).map(([group, opts]) => {
          const visible = opts.filter(filterMatch);
          if (!visible.length) return null;
          const visibleKeys = visible.map((o) => o.key);
          const allSelected = visibleKeys.every((k) => selected.includes(k) || (k !== "*" && selected.includes("*")));
          return (
            <div key={group} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-muted-foreground">{group}</div>
                <button
                  type="button"
                  onClick={() => setForGroup(group, visibleKeys, !allSelected)}
                  className="text-[11px] text-primary hover:underline disabled:opacity-50"
                  disabled={disabled}
                >
                  {allSelected ? "Clear" : "Select all"}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {visible.map((opt) => {
                  const isOn = selected.includes(opt.key);
                  return (
                    <Tooltip key={opt.key}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => toggle(opt.key)}
                          disabled={disabled}
                          className={cn(
                            "rounded-md border px-2.5 py-1 text-xs transition-colors",
                            isOn ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"
                          )}
                          aria-pressed={isOn}
                        >
                          <span className="font-mono">{opt.key}</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" align="start" className="max-w-xs">
                        <div className="text-xs font-medium">{opt.label || opt.key}</div>
                        {opt.description && (
                          <div className="text-[11px] text-muted-foreground mt-1">{opt.description}</div>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {selected.map((k) => (
            <Badge key={k} variant="secondary" className="font-mono text-[10px]">
              {k}
            </Badge>
          ))}
        </div>
      )}
      </div>
    </TooltipProvider>
  );
}

export default ScopeSelector;
