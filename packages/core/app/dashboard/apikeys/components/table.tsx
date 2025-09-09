"use client";
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import ScopeSelector from "@/components/pickers/scope-selector";
import { defaultScopeOptions } from "@/components/pickers/scope-options";
import { toast } from "sonner";

export type ApiKeyItem = {
  id: string;
  name?: string;
  createdAt?: string;
  lastUsedAt?: string | null;
  permissions?: string | string[] | null;
  enabled?: boolean | null;
  expiresAt?: string | null;
  rateLimitEnabled?: boolean | null;
  rateLimitTimeWindow?: number | null;
  rateLimitMax?: number | null;
};

export interface ApiKeysTablePageMeta {
  limit: number;
  offset: number;
  hasMore: boolean;
  total: number;
}

export interface ApiKeysTableProps {
  items: ApiKeyItem[];
  page?: ApiKeysTablePageMeta;
  q?: string;
  sortKey?: "name" | "createdAt" | "lastUsedAt";
  sortDir?: "asc" | "desc";
}

export function ApiKeysTable({ items, page, q, sortKey: initialSortKey, sortDir: initialSortDir }: ApiKeysTableProps) {
  const router = useRouter();
  const [filter, setFilter] = useState(q || "");
  const [sort, setSort] = useState<{ key: "createdAt" | "lastUsedAt" | "name"; dir: "asc" | "desc" }>({ key: initialSortKey || "createdAt", dir: initialSortDir || "desc" });
  const [confirming, setConfirming] = useState<{ id: string; reason: string } | null>(null);
  const [auditing, setAuditing] = useState<{ id: string; logs: any[] } | null>(null);

  function human(s?: string | null) {
    if (!s) return "–";
    const d = new Date(s);
    const diff = Date.now() - d.getTime();
    const abs = Math.abs(diff);
    if (abs < 5_000) return "just now";
    const units: [number, string][] = [
      [60_000, "minute"],
      [3_600_000, "hour"],
      [86_400_000, "day"],
      [604_800_000, "week"],
    ];
    for (let i = units.length - 1; i >= 0; i--) {
      const [ms, label] = units[i];
      if (abs >= ms) {
        const n = Math.floor(abs / ms);
        return diff >= 0 ? `${n} ${label}${n > 1 ? "s" : ""} ago` : `in ${n} ${label}${n > 1 ? "s" : ""}`;
      }
    }
    return "just now";
  }

  const filtered = useMemo(() => {
    // If the current local filter matches server q, trust server-side filtering/sorting
    if ((q || "") === filter) return items;
    const base = items.filter((k) => (k.name || "").toLowerCase().includes(filter.toLowerCase()) || k.id.includes(filter));
    const dirMul = sort.dir === "asc" ? 1 : -1;
    return base.sort((a, b) => {
      const k = sort.key;
      if (k === "name") return dirMul * String(a.name || "").localeCompare(String(b.name || ""));
      const av = a[k] ? new Date(a[k] as string).getTime() : 0;
      const bv = b[k] ? new Date(b[k] as string).getTime() : 0;
      return dirMul * (av - bv);
    });
  }, [items, filter, sort, q]);

  function updateQuery(next: Partial<{ q: string; sortKey: string; sortDir: string; offset: number }>) {
    const u = new URL(window.location.href);
    if (typeof next.q === "string") u.searchParams.set("q", next.q);
    if (typeof next.sortKey === "string") u.searchParams.set("sortKey", next.sortKey);
    if (typeof next.sortDir === "string") u.searchParams.set("sortDir", next.sortDir);
    if (typeof next.offset === "number") u.searchParams.set("offset", String(next.offset));
    router.push(u.pathname + "?" + u.searchParams.toString());
  }

  // Inline toggle for enabled
  async function toggleEnabled(id: string, next: boolean) {
    const res = await fetch(`/api/creator/apikeys?id=${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data?.error || res.statusText || "Failed to update", { description: data?.reason });
    } else {
      router.refresh();
    }
  }

  async function revoke(id: string, reason?: string) {
    const res = await fetch(`/api/creator/apikeys?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data?.error || res.statusText || "Failed to revoke", { description: data?.reason });
    } else {
      toast.success("Key revoked");
      router.refresh();
    }
  }

  async function savePermissions(id: string, scopes: string[]) {
    const needsConfirmStar = scopes.includes("*") && scopes.filter((s) => s !== "*").length > 0;
    const res = await fetch(`/api/creator/apikeys?id=${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scopes, confirmStar: needsConfirmStar }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data?.error || res.statusText || "Failed to update permissions", { description: data?.reason });
    } else {
      toast.success("Permissions updated");
      router.refresh();
    }
  }

  async function saveEdit(id: string, payload: { scopes: string[]; confirmStar?: boolean; name?: string; enabled?: boolean; expiresAt?: string | null; rateLimitEnabled?: boolean; rateLimitTimeWindow?: number; rateLimitMax?: number }) {
    const res = await fetch(`/api/creator/apikeys?id=${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data?.error || res.statusText || "Failed to update", { description: data?.reason });
    } else {
      toast.success("Saved");
      router.refresh();
    }
  }

  async function openAudit(id: string) {
    const res = await fetch(`/api/creator/apikeys?auditKeyId=${encodeURIComponent(id)}`);
    if (!res.ok) {
      setAuditing({ id, logs: [] });
      return;
    }
    const data = await res.json().catch(() => ({}));
    setAuditing({ id, logs: Array.isArray(data?.items) ? data.items : [] });
  }

  function parseScopes(value: ApiKeyItem["permissions"]): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    return String(value).split(/\s+/).filter(Boolean);
  }

  function ScopesCell({ value }: { value: ApiKeyItem["permissions"] }) {
    const scopes = useMemo(() => parseScopes(value), [value]);
    if (!scopes.length) return <span className="text-xs text-muted-foreground">–</span>;
    const max = 4;
    const shown = scopes.slice(0, max);
    const extra = scopes.length - shown.length;
    return (
      <div className="flex flex-wrap gap-1">
        {shown.map((s) => (
          <Badge key={s} variant={s === "*" ? "destructive" : "secondary"} className="text-[10px] px-1.5 py-0.5">
            {s}
          </Badge>
        ))}
        {extra > 0 ? (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">+{extra}</Badge>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Filter by name or ID"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") updateQuery({ q: filter, offset: 0 });
          }}
        />
        <Button variant="secondary" onClick={() => updateQuery({ q: filter, offset: 0 })}>Search</Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <button
                className="font-medium inline-flex items-center gap-1"
                onClick={() => {
                  const nextDir = sort.key === "name" && sort.dir === "asc" ? "desc" : "asc";
                  setSort({ key: "name", dir: nextDir });
                  updateQuery({ sortKey: "name", sortDir: nextDir, offset: 0 });
                }}
              >
                Name {sort.key === "name" ? (sort.dir === "asc" ? "▲" : "▼") : ""}
              </button>
            </TableHead>
            <TableHead>Key ID</TableHead>
            <TableHead>
              <button
                className="font-medium inline-flex items-center gap-1"
                onClick={() => {
                  const nextDir = sort.key === "createdAt" && sort.dir === "asc" ? "desc" : "asc";
                  setSort({ key: "createdAt", dir: nextDir });
                  updateQuery({ sortKey: "createdAt", sortDir: nextDir, offset: 0 });
                }}
              >
                Created {sort.key === "createdAt" ? (sort.dir === "asc" ? "▲" : "▼") : ""}
              </button>
            </TableHead>
            <TableHead>
              <button
                className="font-medium inline-flex items-center gap-1"
                onClick={() => {
                  const nextDir = sort.key === "lastUsedAt" && sort.dir === "asc" ? "desc" : "asc";
                  setSort({ key: "lastUsedAt", dir: nextDir });
                  updateQuery({ sortKey: "lastUsedAt", sortDir: nextDir, offset: 0 });
                }}
              >
                Last Used {sort.key === "lastUsedAt" ? (sort.dir === "asc" ? "▲" : "▼") : ""}
              </button>
            </TableHead>
            <TableHead>Permissions</TableHead>
            <TableHead className="w-[1%] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered?.length ? (
            filtered.map((k) => (
              <TableRow key={k.id}>
                <TableCell>{k.name || "–"}</TableCell>
                <TableCell className="font-mono text-xs">{k.id}</TableCell>
        <TableCell className="text-muted-foreground text-xs" title={k.createdAt || undefined}>{human(k.createdAt)}</TableCell>
        <TableCell className="text-muted-foreground text-xs" title={k.lastUsedAt || undefined}>{human(k.lastUsedAt)}</TableCell>
                <TableCell>
                  <ScopesCell value={k.permissions} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <label className="text-xs inline-flex items-center gap-1">
                      <input type="checkbox" checked={!!k.enabled} onChange={(e) => toggleEnabled(k.id, e.target.checked)} />
                      Enabled
                    </label>
                    <EditPermissionsDialog
          current={parseScopes(k.permissions)}
          original={k}
          onSave={(payload) => saveEdit(k.id, payload)}
                    />
                    <Dialog open={!!confirming && confirming.id === k.id} onOpenChange={(v) => !v && setConfirming(null)}>
                      <DialogTrigger asChild>
                        <Button variant="destructive" size="sm" onClick={() => setConfirming({ id: k.id, reason: "" })}>Revoke</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Revoke API Key</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-2">
                          <label className="text-sm">Reason (optional)</label>
                          <Input value={confirming?.reason || ""} onChange={(e) => setConfirming((c) => (c ? { ...c, reason: e.target.value } : c))} placeholder="e.g. rotated, leaked, not needed" />
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setConfirming(null)}>Cancel</Button>
                          <Button variant="destructive" onClick={async () => { await revoke(k.id, confirming?.reason); setConfirming(null); }}>Revoke</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <Button variant="outline" size="sm" onClick={() => openAudit(k.id)}>Audit</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">No API keys.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {/* Pagination */}
      {page ? (
        <div className="mt-3 flex items-center justify-between text-sm">
          <div>
            Showing {page.offset + 1}-{Math.min(page.offset + (items?.length || 0), page.total || 0)} of {page.total || 0}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page.offset <= 0}
              onClick={() => updateQuery({ offset: Math.max(0, page.offset - page.limit) })}
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!page.hasMore}
              onClick={() => updateQuery({ offset: page.offset + page.limit })}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={!!auditing} onOpenChange={(v) => !v && setAuditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Audit History</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto text-xs space-y-2">
            {auditing?.logs?.length ? auditing.logs.map((l, i) => (
              <div key={i} className="rounded border p-2">
                <div className="font-medium">{l.eventType}</div>
                <div className="text-muted-foreground">{new Date(l.createdAt).toLocaleString()}</div>
                <pre className="whitespace-pre-wrap break-words mt-1">{JSON.stringify(l.metadata, null, 2)}</pre>
              </div>
            )) : <div className="text-muted-foreground">No audit logs.</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAuditing(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type EditPayload = {
  scopes: string[];
  confirmStar?: boolean;
  name?: string;
  enabled?: boolean;
  expiresAt?: string | null;
  rateLimitEnabled?: boolean;
  rateLimitTimeWindow?: number;
  rateLimitMax?: number;
};

function EditPermissionsDialog({ current, original, onSave }: { current: string[]; original?: ApiKeyItem; onSave: (payload: EditPayload) => Promise<void> | void }) {
  const [open, setOpen] = useState(false);
  const [scopes, setScopes] = useState<string[]>(current);
  const [name, setName] = useState<string>(original?.name || "");
  const [enabled, setEnabled] = useState<boolean>(original?.enabled ?? true);
  const [expiresAt, setExpiresAt] = useState<string>(original?.expiresAt ? original.expiresAt.slice(0, 16) : "");
  const [rateLimitEnabled, setRateLimitEnabled] = useState<boolean>(Boolean(original?.rateLimitEnabled));
  const [rateLimitTimeWindow, setRateLimitTimeWindow] = useState<number>(Number(original?.rateLimitTimeWindow ?? 60_000));
  const [rateLimitMax, setRateLimitMax] = useState<number>(Number(original?.rateLimitMax ?? 60));
  const [confirmStar, setConfirmStar] = useState<boolean>(false);

  function handleOpenChange(next: boolean) {
    if (next) setScopes(current);
    setOpen(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">Edit</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit API Key</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch id="enabled" checked={enabled} onCheckedChange={setEnabled} />
              <Label htmlFor="enabled">Enabled</Label>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="expires">Expires At</Label>
              <Input id="expires" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch id="rl-enabled" checked={rateLimitEnabled} onCheckedChange={setRateLimitEnabled} />
              <Label htmlFor="rl-enabled">Rate limit</Label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" min={0} value={rateLimitMax} onChange={(e) => setRateLimitMax(Number(e.target.value))} placeholder="Max" />
              <Input type="number" min={0} value={rateLimitTimeWindow} onChange={(e) => setRateLimitTimeWindow(Number(e.target.value))} placeholder="Window ms" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Permissions</Label>
              {scopes.includes("*") && scopes.filter((s) => s !== "*").length > 0 ? (
                <label className="text-xs flex items-center gap-2">
                  <input type="checkbox" checked={confirmStar} onChange={(e) => setConfirmStar(e.target.checked)} />
                  Confirm mixing '*' with specific scopes
                </label>
              ) : null}
            </div>
            <ScopeSelector options={defaultScopeOptions} value={scopes} onChange={setScopes} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={async () => {
            await onSave({
              scopes,
              confirmStar: confirmStar || (scopes.includes("*") && scopes.filter((s) => s !== "*").length > 0),
              name,
              enabled,
              expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
              rateLimitEnabled,
              rateLimitTimeWindow,
              rateLimitMax,
            });
            setOpen(false);
          }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

