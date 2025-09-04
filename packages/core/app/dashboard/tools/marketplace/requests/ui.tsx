"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

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

  async function load(status: string) {
    setLoading(true);
    try {
      const r = await fetch(`/api/tools/marketplace/requests?status=${status}`, { credentials: "include" });
      const d = await r.json();
      setItems(d.items || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(tab);
  }, [tab]);

  async function act(id: string, action: "approve" | "reject") {
    setLoading(true);
    try {
      const body: any = { id, action };
      if (action === "reject") body.rejectReason = reason[id] || "";
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
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList ref={undefined as any}>
        <TabsTrigger ref={undefined as any} value="pending">Pending</TabsTrigger>
        <TabsTrigger ref={undefined as any} value="approved">Approved</TabsTrigger>
        <TabsTrigger ref={undefined as any} value="rejected">Rejected</TabsTrigger>
      </TabsList>

      {(["pending", "approved", "rejected"] as const).map((s) => (
        <TabsContent ref={undefined as any} key={s} value={s} className="mt-4 space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : !items.length ? (
            <div className="text-sm text-muted-foreground">No {s} requests.</div>
          ) : (
            items.map((it) => (
              <Card key={it.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{it.title}</div>
                      <div className="text-xs text-muted-foreground truncate">{it.url}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {it.store ? <Badge variant="secondary">{it.store}</Badge> : null}
                      {it.price ? <Badge variant="outline">L$ {it.price}</Badge> : null}
                      <Badge variant="outline">{it.images?.length || 0} images</Badge>
                    </div>
                  </div>
                  {it.description ? (
                    <div className="text-sm text-muted-foreground line-clamp-3">{it.description}</div>
                  ) : null}

                  {s === "pending" ? (
                    <div className="flex items-center gap-2 pt-2">
                      <Button size="sm" onClick={() => act(it.id, "approve")} disabled={loading}>Approve</Button>
                      <Button size="sm" variant="destructive" onClick={() => act(it.id, "reject")} disabled={loading}>Reject</Button>
                      <Textarea
                        placeholder="Optional: reason"
                        value={reason[it.id] || ""}
                        onChange={(e) => setReason((m) => ({ ...m, [it.id]: e.target.value }))}
                        className="h-8 text-xs"
                      />
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
