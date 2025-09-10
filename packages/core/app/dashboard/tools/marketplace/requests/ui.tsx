"use client";

import { useEffect, useState, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, RefreshCw, Search, CheckCircle2, XCircle, ChevronDown, ChevronRight, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

type RequestItem = {
  id: string;
  title: string;
  url: string;
  store: string | null;
  price: string | null;
  images: string[];
  description: string | null;
  creator: { name: string; link: string } | null;
  permissions: { copy: string; modify: string; transfer: string } | null;
  categoryIds?: string[] | null;
  status: string;
  createdAt: string;
};

export default function RequestsClient() {
  const [tab, setTab] = useState("pending");
  const [items, setItems] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 25;
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const allSelected = useMemo(() => {
    return items.length > 0 && items.every((i) => selected[i.id]);
  }, [items, selected]);
  const anySelected = useMemo(() => items.some((i) => selected[i.id]), [items, selected]);

  async function load(status: string) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("status", status);
      if (q.trim()) params.set("q", q.trim());
      params.set("limit", String(pageSize));
      params.set("offset", String(page * pageSize));
      params.set("include", "counts");
      const r = await fetch(`/api/tools/marketplace/requests?${params.toString()}`, { credentials: "include" });
      const d = await r.json();
      setItems(d.items || []);
      if (d.counts) setCounts(d.counts);
      setSelected({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(tab);
  }, [tab, page]);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(0);
    load(tab);
  }

  function toggleSelect(id: string) {
    setSelected((m) => ({ ...m, [id]: !m[id] }));
  }

  function toggleExpand(id: string) {
    setExpanded((m) => ({ ...m, [id]: !m[id] }));
  }

  function toggleAll() {
    if (allSelected) {
      const cleared: Record<string, boolean> = {};
      setSelected(cleared);
    } else {
      const next: Record<string, boolean> = {};
      for (const it of items) next[it.id] = true;
      setSelected(next);
    }
  }

  async function act(id: string | null, action: "approve" | "reject") {
    setLoading(true);
    try {
      const body: any = { action };
      if (id) body.id = id;
      else body.ids = Object.keys(selected).filter((k) => selected[k]);
      if (action === "reject") {
        if (id) body.rejectReason = reason[id] || "";
        else body.rejectReason = "batch"; // generic reason placeholder
      }
      const r = await fetch("/api/tools/marketplace/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (r.ok) {
        await load(tab);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Tabs value={tab} onValueChange={(v) => { setTab(v); setPage(0); }}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2">
        <TabsList ref={undefined as any} className="shrink-0">
          <TabsTrigger ref={undefined as any} value="pending">Pending{counts.pending !== undefined ? ` (${counts.pending})` : ""}</TabsTrigger>
          <TabsTrigger ref={undefined as any} value="approved">Approved{counts.approved !== undefined ? ` (${counts.approved})` : ""}</TabsTrigger>
          <TabsTrigger ref={undefined as any} value="rejected">Rejected{counts.rejected !== undefined ? ` (${counts.rejected})` : ""}</TabsTrigger>
        </TabsList>
        <form onSubmit={onSearch} className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-60">
            <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="pl-7 h-8 text-xs" />
          </div>
          <Button type="submit" size="sm" variant="outline" disabled={loading}><RefreshCw className="h-3.5 w-3.5" /></Button>
        </form>
      </div>

      {anySelected && tab === "pending" ? (
        <div className="flex items-center gap-2 mb-2 text-xs">
          <span className="text-muted-foreground">{Object.keys(selected).filter((k) => selected[k]).length} selected</span>
          <Button size="sm" variant="secondary" className="h-7 px-2" onClick={() => act(null, "approve")} disabled={loading}><CheckCircle2 className="h-3 w-3 mr-1" /> Approve</Button>
          <Button size="sm" variant="destructive" className="h-7 px-2" onClick={() => act(null, "reject")} disabled={loading}><XCircle className="h-3 w-3 mr-1" /> Reject</Button>
          <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setSelected({})} disabled={loading}>Clear</Button>
        </div>
      ) : null}

      {(["pending", "approved", "rejected"] as const).map((s) => (
        <TabsContent ref={undefined as any} key={s} value={s} className="mt-4 space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : !items.length ? (
            <div className="text-sm text-muted-foreground">No {s} requests.</div>
          ) : (
            items.map((it) => {
              const isExpanded = !!expanded[it.id];
              const reasonVal = reason[it.id] || "";
              const created = new Date(it.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
              return (
                <Card key={it.id} className={cn("transition-colors", selected[it.id] ? "border-primary shadow-sm" : "hover:border-muted-foreground/30")}> 
                  <CardContent className="p-4 space-y-3">
                    {/* Header Row */}
                    <div className="flex items-start gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {s === "pending" ? (
                          <Checkbox checked={!!selected[it.id]} onCheckedChange={() => toggleSelect(it.id)} className="mt-1" />
                        ) : null}
                        <button type="button" onClick={() => toggleExpand(it.id)} className="mt-0.5 text-muted-foreground hover:text-foreground transition-colors">
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium leading-none truncate max-w-[260px]" title={it.title}>{it.title}</span>
                            {it.store ? <Badge variant="secondary" className="text-[10px] py-0 px-1.5">{it.store}</Badge> : null}
                            {it.price ? <Badge variant="outline" className="text-[10px] py-0 px-1.5">L$ {it.price}</Badge> : null}
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5">{it.images?.length || 0} img</Badge>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span className="truncate max-w-[320px]" title={it.url}>{it.url.replace(/^https?:\/\//, "")}</span>
                            <span className="opacity-60">•</span>
                            <span>{created}</span>
                            {it.permissions ? (
                              <span className="hidden sm:inline opacity-80" title={`Copy: ${it.permissions.copy} Modify: ${it.permissions.modify} Transfer: ${it.permissions.transfer}`}>Perms: {it.permissions.copy}/{it.permissions.modify}/{it.permissions.transfer}</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      {/* Removed header approve/reject buttons to keep single action area in footer */}
                    </div>

                    {/* Image preview thumbnails */}
                    {it.images && it.images.length > 0 ? (
                      <div className={cn("flex gap-2 overflow-x-auto pb-1 pt-0.5", isExpanded ? "" : "")}> 
                        {it.images.slice(0, isExpanded ? 6 : 3).map((src, i) => (
                          <div key={i} className="relative h-14 w-14 shrink-0 rounded border bg-muted overflow-hidden">
                            <img src={src} alt={`${it.title} ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
                          </div>
                        ))}
                        {it.images.length > (isExpanded ? 6 : 3) && !isExpanded && (
                          <div className="h-14 w-14 flex items-center justify-center text-[10px] border rounded bg-muted/50">
                            +{it.images.length - 3} more
                          </div>
                        )}
                      </div>
                    ) : null}

                    {/* Description / Expanded */}
                    {it.description ? (
                      <div className={cn("text-[12px] leading-relaxed text-muted-foreground relative", !isExpanded && "line-clamp-2")}> 
                        <span className={cn(!isExpanded && "[mask-image:linear-gradient(180deg,#000_70%,transparent)]")}>{it.description}</span>
                        {!isExpanded && (
                          <button type="button" onClick={() => toggleExpand(it.id)} className="absolute bottom-0 right-0 text-xs font-medium px-1 bg-background/80 backdrop-blur-sm hover:underline">
                            More
                          </button>
                        )}
                      </div>
                    ) : null}

                    {isExpanded ? (
                      <div className="grid gap-2 text-[11px] text-muted-foreground">
                        {it.creator ? (
                          <div className="flex items-center gap-1"><span className="font-medium text-foreground">Creator:</span><a href={it.creator.link} target="_blank" className="underline line-clamp-1" rel="noreferrer">{it.creator.name}</a></div>
                        ) : null}
                        {it.permissions ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-foreground">Permissions:</span>
                            {(["copy","modify","transfer"] as const).map((k) => {
                              const v = (it.permissions as any)[k];
                              const denied = typeof v === "string" ? /^no/i.test(v) : v === false || v === 0;
                              return (
                                <Badge
                                  key={k}
                                  variant="outline"
                                  title={`${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}`}
                                  className={cn(
                                    "text-[10px] py-0 px-1.5",
                                    denied
                                      ? "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400"
                                      : "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                                  )}
                                >
                                  {k[0].toUpperCase()}
                                </Badge>
                              );
                            })}
                          </div>
                        ) : null}
                        <div className="flex items-center gap-1 opacity-80"><Info className="h-3 w-3" /> ID: <code className="text-[10px] bg-muted px-1 py-0.5 rounded">{it.id.slice(0,8)}</code></div>
                      </div>
                    ) : null}

                    {/* Reason & Actions footer (pending only) */}
                    {s === "pending" ? (
                      <div className="pt-3 mt-1 border-t">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                          <Textarea
                            placeholder="Optional rejection reason"
                            value={reasonVal}
                            onChange={(e) => setReason((m) => ({ ...m, [it.id]: e.target.value }))}
                            className="text-xs resize-none h-16 sm:flex-1"
                          />
                          <div className="flex gap-2 sm:flex-col">
                            <Button size="sm" className="h-8 px-3" onClick={() => act(it.id, "approve")} disabled={loading}>Approve</Button>
                            <Button size="sm" variant="destructive" className="h-8 px-3" onClick={() => act(it.id, "reject")} disabled={loading}>Reject</Button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })
          )}
          {items.length === pageSize ? (
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                Page {page + 1}
                {s === "pending" && items.length ? (
                  <Button size="sm" variant="ghost" className="h-6 px-2" onClick={toggleAll}>{allSelected ? "Unselect all" : "Select all"}</Button>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-7 px-2" disabled={page === 0 || loading} onClick={() => setPage((p) => Math.max(0, p - 1))}>Prev</Button>
                <Button size="sm" variant="outline" className="h-7 px-2" disabled={loading || items.length < pageSize} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between pt-2 text-[11px] text-muted-foreground">
              <span>Showing {items.length} item(s)</span>
              {s === "pending" && items.length ? (
                <Button size="sm" variant="ghost" className="h-6 px-2" onClick={toggleAll}>{allSelected ? "Unselect all" : "Select all"}</Button>
              ) : null}
            </div>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
