"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";

export type WebhookItem = {
  id: string;
  targetUrl: string;
  active: boolean;
  events: string[];
};

export function WebhooksTable({ items }: { items: WebhookItem[] }) {
  const [filter, setFilter] = useState("");
  const filtered = items.filter((w) => w.targetUrl.toLowerCase().includes(filter.toLowerCase()));
  return (
    <div className="space-y-3">
      <Input placeholder="Filter by URL" value={filter} onChange={(e) => setFilter(e.target.value)} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Target</TableHead>
            <TableHead>Events</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered?.length ? (
            filtered.map((w) => (
              <TableRow key={w.id}>
                <TableCell className="truncate max-w-[280px]">{w.targetUrl}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{w.events.join(", ")}</TableCell>
                <TableCell>{w.active ? "Active" : "Inactive"}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">No webhooks.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
