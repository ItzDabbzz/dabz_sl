"use client";

import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import CopyButton from "@/components/ui/copy-button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";

export type WebhookItem = {
  id: string;
  targetUrl: string;
  active: boolean;
  events: string[];
  secretLast4?: string;
};

interface Props {
  items: WebhookItem[];
  onTest?: (form: FormData) => Promise<void>;
  onToggleActive?: (form: FormData) => Promise<void>;
  onBulk?: (form: FormData) => Promise<void>;
  onRotateSecret?: (form: FormData) => Promise<void>;
  onLoadLogs?: (form: FormData) => Promise<{ items: Array<{ id: string; event: string; responseStatus?: number; error?: string; durationMs?: number; createdAt: string; responseBody?: string }>; page?: number; pageSize?: number; hasMore?: boolean }>;
  onRetryDelivery?: (form: FormData) => Promise<void>;
}

type SortKey = "targetUrl" | "status" | "events";

export function WebhooksTable({ items, onTest, onToggleActive, onBulk, onRotateSecret, onLoadLogs, onRetryDelivery }: Props) {
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("targetUrl");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const f = filter.toLowerCase();
    return items.filter((w) =>
      w.targetUrl.toLowerCase().includes(f) ||
      w.events.join(",").toLowerCase().includes(f)
    );
  }, [items, filter]);

  const sorted = useMemo(() => {
    const s = [...filtered].sort((a, b) => {
      let va: string | number = "";
      let vb: string | number = "";
      if (sortKey === "targetUrl") {
        va = a.targetUrl.toLowerCase();
        vb = b.targetUrl.toLowerCase();
      } else if (sortKey === "events") {
        va = a.events.length;
        vb = b.events.length;
      } else {
        va = a.active ? 1 : 0;
        vb = b.active ? 1 : 0;
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return s;
  }, [filtered, sortKey, sortDir]);

  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paged = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, currentPage, pageSize]);

  const allVisibleSelected = paged.every((w) => selected[w.id]);
  const anyVisibleSelected = paged.some((w) => selected[w.id]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function setAllVisible(checked: boolean) {
    const next = { ...selected };
    for (const w of paged) next[w.id] = checked;
    setSelected(next);
  }

  function clearSelection() {
    setSelected({});
  }

  function selectedIds(): string[] {
    return Object.entries(selected)
      .filter(([, v]) => v)
      .map(([k]) => k);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Input placeholder="Filter by URL or event" value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }} className="w-64" />
          <div className="text-sm text-muted-foreground">{total} total</div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Rows</label>
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
            {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          {onBulk && (
            <>
              <form action={onBulk}>
                <input type="hidden" name="op" value="enable" />
                <input type="hidden" name="ids" value={selectedIds().join(",")} />
                <Button size="sm" variant="secondary" disabled={!anyVisibleSelected}>Enable</Button>
              </form>
              <form action={onBulk}>
                <input type="hidden" name="op" value="disable" />
                <input type="hidden" name="ids" value={selectedIds().join(",")} />
                <Button size="sm" variant="secondary" disabled={!anyVisibleSelected}>Disable</Button>
              </form>
              <form action={onBulk}>
                <input type="hidden" name="op" value="test" />
                <input type="hidden" name="ids" value={selectedIds().join(",")} />
                <Button size="sm" disabled={!anyVisibleSelected}>Test</Button>
              </form>
              <Button size="sm" variant="ghost" onClick={clearSelection} disabled={!anyVisibleSelected}>Clear</Button>
            </>
          )}
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={allVisibleSelected} onCheckedChange={(c) => setAllVisible(Boolean(c))} aria-label="Select page" />
              </TableHead>
              <TableHead role="button" onClick={() => toggleSort("targetUrl")} className={cn("cursor-pointer select-none", sortKey === "targetUrl" && "text-foreground")}>Target {sortKey === "targetUrl" ? (sortDir === "asc" ? "▲" : "▼") : null}</TableHead>
              <TableHead role="button" onClick={() => toggleSort("events")} className={cn("cursor-pointer select-none", sortKey === "events" && "text-foreground")}>Events {sortKey === "events" ? (sortDir === "asc" ? "▲" : "▼") : null}</TableHead>
              <TableHead role="button" onClick={() => toggleSort("status")} className={cn("cursor-pointer select-none", sortKey === "status" && "text-foreground")}>Status {sortKey === "status" ? (sortDir === "asc" ? "▲" : "▼") : null}</TableHead>
              <TableHead className="w-[220px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged?.length ? (
              paged.map((w) => (
                <TableRow key={w.id} data-state={selected[w.id] ? "selected" : undefined}>
                  <TableCell className="w-10">
                    <Checkbox checked={!!selected[w.id]} onCheckedChange={(c) => setSelected((prev) => ({ ...prev, [w.id]: Boolean(c) }))} aria-label={`Select ${w.targetUrl}`} />
                  </TableCell>
                  <TableCell className="truncate max-w-[320px]">
                    <div className="text-sm font-medium leading-tight">{w.targetUrl}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{w.id}</span>
                      <CopyButton textToCopy={w.id} />
                      <CopyButton textToCopy={w.targetUrl} />
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    <div className="flex flex-wrap gap-1">
                      {(w.events?.length ? w.events : ["All events"]).map((e) => (
                        <Badge key={e} variant="secondary">{e}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs", w.active ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600")}>{w.active ? "Active" : "Inactive"}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {onTest && (
                        <form action={onTest}>
                          <input type="hidden" name="id" value={w.id} />
                          <Button size="sm" variant="secondary">Test</Button>
                        </form>
                      )}
                      <DestinationsDrawer webhookId={w.id} />
                      {onToggleActive && (
                        <form
                          action={async (fd) => {
                            try {
                              await onToggleActive(fd);
                              toast.success(w.active ? "Deactivated" : "Activated");
                            } catch {
                              toast.error("Action failed");
                            }
                          }}
                        >
                          <input type="hidden" name="id" value={w.id} />
                          <input type="hidden" name="active" value={String(!w.active)} />
                          <Button size="sm" variant={w.active ? "destructive" : "default"}>{w.active ? "Deactivate" : "Activate"}</Button>
                        </form>
                      )}
                      {typeof w.secretLast4 !== "undefined" && onRotateSecret && (
                        <div className="ml-2 inline-flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Secret ••••{w.secretLast4}</span>
                          <form
                            action={async (fd) => {
                              try {
                                await onRotateSecret(fd);
                                toast.success("Secret rotated");
                              } catch {
                                toast.error("Failed to rotate secret");
                              }
                            }}
                          >
                            <input type="hidden" name="id" value={w.id} />
                            <Button size="sm" variant="outline">Rotate</Button>
                          </form>
                        </div>
                      )}
                      {onLoadLogs && (
                        <LogsDialog webhookId={w.id} onLoadLogs={onLoadLogs} onRetry={onRetryDelivery} />
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        type="button"
                        onClick={() => {
                          const curl = `curl -X POST -H "Content-Type: application/json"${w.secretLast4 ? " -H \"X-Webhook-Signature: <secret>\"" : ""} -d '{"event":"test.ping","data":{"hello":"world"}}' '${w.targetUrl}'`;
                          navigator.clipboard.writeText(curl).then(() => toast.success("Copied curl command"));
                        }}
                      >
                        Copy curl
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">No webhooks.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Page {currentPage} of {pageCount}</div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
          <Button size="sm" variant="outline" disabled={currentPage >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>Next</Button>
        </div>
      </div>
    </div>
  );
}

function DestinationsDrawer({ webhookId }: { webhookId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Array<{ id: string; type: string; enabled: boolean; events: string[]; configJson: any }>>([]);
  const [type, setType] = useState<'http' | 'discord'>('discord');
  const [events, setEvents] = useState<string>('');
  const [url, setUrl] = useState('');
  const [payloadJson, setPayloadJson] = useState<string>('{}');
  const [scope, setScope] = useState<{ scopeType: 'org' | 'team' | 'user'; scopeId: string } | null>(null);
  const [discordChannels, setDiscordChannels] = useState<Array<{ id: string; name: string; webhookUrl: string }>>([]);
  const [discordPresets, setDiscordPresets] = useState<Array<{ id: string; name: string; payloadJson: any }>>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/creator/webhooks/${encodeURIComponent(webhookId)}/destinations`, { headers: { 'cache-control': 'no-store' } });
      const data = await res.json().catch(() => ({ items: [] }));
      setItems(data?.items || []);
      if (data?.webhook?.scopeType && data?.webhook?.scopeId) {
        setScope({ scopeType: data.webhook.scopeType, scopeId: data.webhook.scopeId });
        const qs = new URLSearchParams();
        qs.set('scopeType', data.webhook.scopeType);
        qs.set('scopeId', data.webhook.scopeId);
        // Load saved Discord channels and presets for selection
        const [ch, pr] = await Promise.all([
          fetch(`/api/creator/integrations/discord/channels?${qs.toString()}`).then((r) => r.json()).catch(() => ({ items: [] })),
          fetch(`/api/creator/integrations/discord/presets?${qs.toString()}`).then((r) => r.json()).catch(() => ({ items: [] })),
        ]);
        setDiscordChannels(Array.isArray(ch?.items) ? ch.items : []);
        setDiscordPresets(Array.isArray(pr?.items) ? pr.items : []);
      }
    } finally {
      setLoading(false);
    }
  }

  async function create() {
    try {
      const body: any = { type, enabled: true, events: events.split(/\s*,\s*/).filter(Boolean), configJson: {} };
      if (type === 'http') body.configJson = { url };
      if (type === 'discord') {
        // Prefer saved channel selection if chosen; fallback to manual URL
        const selected = discordChannels.find((c) => c.id === selectedChannelId);
        const webhookUrl = selected?.webhookUrl || url;
  const preset = discordPresets.find((p) => p.id === selectedPresetId)?.payloadJson;
        const payload = preset || JSON.parse(payloadJson || '{}');
        body.configJson = { urls: webhookUrl ? [webhookUrl] : [], payloadJson: payload };
      }
      const res = await fetch(`/api/creator/webhooks/${encodeURIComponent(webhookId)}/destinations`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error('create_failed');
      await load();
      setUrl('');
      setEvents('');
      setSelectedChannelId('');
      setSelectedPresetId('');
      toast.success('Destination added');
    } catch {
      toast.error('Failed to create destination');
    }
  }

  async function toggleEnabled(id: string, enabled: boolean) {
    try {
      const res = await fetch(`/api/creator/webhooks/${encodeURIComponent(webhookId)}/destinations/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error('toggle_failed');
      toast.success(enabled ? 'Enabled' : 'Disabled');
      await load();
    } catch {
      toast.error('Failed to update');
    }
  }

  async function remove(id: string) {
    try {
      const res = await fetch(`/api/creator/webhooks/${encodeURIComponent(webhookId)}/destinations/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete_failed');
      toast.success('Destination deleted');
      await load();
    } catch {
      toast.error('Failed to delete destination');
    }
  }

  return (
    <Drawer open={open} onOpenChange={(v) => { setOpen(v); if (v) load(); }}>
      <DrawerTrigger asChild>
        <Button size="sm" variant="outline">Destinations</Button>
      </DrawerTrigger>
      <DrawerContent className="p-4">
        <DrawerHeader>
          <DrawerTitle>Destinations</DrawerTitle>
        </DrawerHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <select className="h-9 rounded-md border bg-background px-2 text-sm" value={type} onChange={(e) => setType(e.target.value as any)}>
              <option value="discord">Discord</option>
              <option value="http">HTTP</option>
            </select>
            {type === 'discord' ? (
              <div className="flex w-full items-center gap-2">
                <select className="h-9 w-64 rounded-md border bg-background px-2 text-sm" value={selectedChannelId} onChange={(e) => setSelectedChannelId(e.target.value)}>
                  <option value="">Select saved channel…</option>
                  {discordChannels.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <Input placeholder={'…or paste Discord webhook URL'} value={url} onChange={(e) => setUrl(e.target.value)} className="flex-1" />
                <select className="h-9 w-64 rounded-md border bg-background px-2 text-sm" value={selectedPresetId} onChange={(e) => setSelectedPresetId(e.target.value)}>
                  <option value="">Embed preset (optional)</option>
                  {discordPresets.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <Input placeholder={'https://example.com/webhook'} value={url} onChange={(e) => setUrl(e.target.value)} className="flex-1" />
            )}
            <Input placeholder="events (comma-separated)" value={events} onChange={(e) => setEvents(e.target.value)} className="w-64" />
            <Button size="sm" onClick={create}>Add</Button>
          </div>
          {type === 'discord' && (
            <Textarea placeholder="Discord payload JSON (optional, uses simple content if empty)" value={payloadJson} onChange={(e) => setPayloadJson(e.target.value)} className="font-mono text-xs" rows={4} />
          )}
          <div className="text-sm text-muted-foreground">Existing</div>
          <div className="max-h-[50vh] overflow-auto space-y-2">
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : items.length ? (
              items.map((d) => (
                <div key={d.id} className="rounded border p-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Badge variant="secondary">{d.type}</Badge>
                      <span className={cn('text-xs', d.enabled ? 'text-emerald-600' : 'text-amber-600')}>{d.enabled ? 'Enabled' : 'Disabled'}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {d.type === 'http' ? (d.configJson?.url || d.configJson?.targetUrl || '—') :
                          (Array.isArray(d.configJson?.urls) ? d.configJson.urls[0] : d.configJson?.url) || '—'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => toggleEnabled(d.id, !d.enabled)}>
                        {d.enabled ? 'Disable' : 'Enable'}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => remove(d.id)}>Delete</Button>
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">Events: {d.events?.length ? d.events.join(', ') : 'All'}</div>
                  <EditableDestinationRow webhookId={webhookId} dest={d} onSaved={load} presets={discordPresets} channels={discordChannels} />
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">No destinations yet.</div>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function EditableDestinationRow({ webhookId, dest, onSaved, presets, channels }: { webhookId: string; dest: { id: string; type: string; enabled: boolean; events: string[]; configJson: any }; onSaved: () => void; presets: Array<{ id: string; name: string; payloadJson: any }>; channels: Array<{ id: string; name: string; webhookUrl: string }> }) {
  const [editing, setEditing] = useState(false);
  const [events, setEvents] = useState<string>(dest.events?.join(', ') || '');
  const [url, setUrl] = useState<string>(dest.type === 'http' ? (dest.configJson?.url || '') : (Array.isArray(dest.configJson?.urls) ? dest.configJson.urls[0] : (dest.configJson?.url || '')));
  const [payloadJson, setPayloadJson] = useState<string>(dest.type === 'discord' ? JSON.stringify(dest.configJson?.payloadJson ?? {}, null, 2) : '');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');

  async function save() {
    try {
      const patch: any = { events: events.split(/\s*,\s*/).filter(Boolean) };
      if (dest.type === 'http') patch.configJson = { url };
      if (dest.type === 'discord') {
        const selected = channels.find((c) => c.id === selectedChannelId);
        const webhookUrl = selected?.webhookUrl || url;
        let payload = presets.find((p) => p.id === selectedPresetId)?.payloadJson;
        if (!payload) {
          try { payload = JSON.parse(payloadJson || '{}'); } catch { payload = {}; }
        }
        patch.configJson = { urls: webhookUrl ? [webhookUrl] : [], payloadJson: payload };
      }
      const res = await fetch(`/api/creator/webhooks/${encodeURIComponent(webhookId)}/destinations/${encodeURIComponent(dest.id)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) });
      if (!res.ok) throw new Error('save_failed');
      toast.success('Destination updated');
      setEditing(false);
      onSaved();
    } catch {
      toast.error('Failed to save');
    }
  }

  if (!editing) {
    return (
      <div className="mt-2 flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Edit</Button>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded border bg-muted/30 p-2">
      <div className="flex items-center gap-2">
        <Input placeholder="events (comma-separated)" value={events} onChange={(e) => setEvents(e.target.value)} />
      </div>
      {dest.type === 'http' ? (
        <div className="flex items-center gap-2">
          <Input placeholder="https://example.com/webhook" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <select className="h-9 w-64 rounded-md border bg-background px-2 text-sm" value={selectedChannelId} onChange={(e) => setSelectedChannelId(e.target.value)}>
              <option value="">Select saved channel…</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <Input placeholder="…or paste Discord webhook URL" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <select className="h-9 w-64 rounded-md border bg-background px-2 text-sm" value={selectedPresetId} onChange={(e) => setSelectedPresetId(e.target.value)}>
              <option value="">Embed preset (optional)</option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <Textarea rows={6} className="font-mono text-xs" placeholder="Discord payload JSON" value={payloadJson} onChange={(e) => setPayloadJson(e.target.value)} />
        </div>
      )}
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={save}>Save</Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
      </div>
    </div>
  );
}

function LogsDialog({ webhookId, onLoadLogs, onRetry }: { webhookId: string; onLoadLogs: NonNullable<Props["onLoadLogs"]>; onRetry?: Props["onRetryDelivery"] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Array<{ id: string; event: string; responseStatus?: number; error?: string; durationMs?: number; createdAt: string; responseBody?: string; transport?: string; targetUrl?: string; destinationId?: string; destinationLabel?: string }>>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [hasMore, setHasMore] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "2xx" | "4xx" | "5xx" | "failed">("all");

  async function load(nextPage = page) {
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("id", webhookId);
      fd.append("page", String(nextPage));
      fd.append("pageSize", String(pageSize));
      if (q) fd.append("q", q);
      if (status) fd.append("status", status);
      const res = await onLoadLogs(fd);
      setItems(res?.items || []);
      setHasMore(Boolean(res?.hasMore));
      setPage(res?.page || nextPage);
    } catch (e) {
      toast.error("Failed to load logs");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) load(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">Logs</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Recent deliveries</DialogTitle>
          <DialogDescription>Latest attempts for this webhook endpoint.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 p-2">
          <Input placeholder="Search by event" value={q} onChange={(e) => setQ(e.target.value)} className="w-60" />
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value as any)}>
            <option value="all">All</option>
            <option value="2xx">2xx</option>
            <option value="4xx">4xx</option>
            <option value="5xx">5xx</option>
            <option value="failed">Failed</option>
          </select>
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
            {[10, 20, 50].map((n) => <option key={n} value={n}>{n} / page</option>)}
          </select>
          <Button size="sm" onClick={() => { setPage(1); load(1); }}>Apply</Button>
        </div>
        <div className="max-h-[60vh] overflow-auto space-y-2">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : items.length ? (
            items.map((l) => (
              <div key={l.id} className="rounded-md border p-2">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{l.event}</Badge>
                    <span className="text-muted-foreground">{new Date(l.createdAt).toLocaleString()}</span>
                    {l.transport && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">{l.transport}</span>
                    )}
                    {l.destinationLabel && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground" title={l.destinationId || undefined}>{l.destinationLabel}</span>
                    )}
                    {l.targetUrl && (
                      <span title={l.targetUrl} className="max-w-[280px] truncate text-xs text-muted-foreground">{l.targetUrl}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs", l.responseStatus && l.responseStatus >= 200 && l.responseStatus < 300 ? "text-emerald-600" : l.error ? "text-amber-600" : "text-stone-600")}>{l.responseStatus ?? "—"}</span>
                    {typeof l.durationMs === "number" && (
                      <span className="text-xs text-muted-foreground">{l.durationMs}ms</span>
                    )}
                    {onRetry && (
                      <form
                        action={async (fd) => {
                          try {
                            await onRetry(fd);
                            toast.success("Retry triggered");
                            await load(page);
                          } catch {
                            toast.error("Retry failed");
                          }
                        }}
                      >
                        <input type="hidden" name="deliveryId" value={l.id} />
                        <Button size="sm" variant="secondary">Retry</Button>
                      </form>
                    )}
                  </div>
                </div>
                {l.error && <div className="text-xs text-amber-700">{l.error}</div>}
                {l.responseBody && (
                  <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap">{l.responseBody}</pre>
                )}
              </div>
            ))
          ) : (
            <div className="text-sm text-muted-foreground">No deliveries yet.</div>
          )}
        </div>
        <div className="flex items-center justify-between p-2">
          <div className="text-xs text-muted-foreground">Page {page}</div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); load(p); }}>Previous</Button>
            <Button size="sm" variant="outline" disabled={!hasMore} onClick={() => { const p = page + 1; setPage(p); load(p); }}>Next</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
