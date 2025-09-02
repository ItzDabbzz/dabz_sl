"use client";

import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";

export type InstanceItem = {
  id: string;
  ownerSlUuid: string;
  status: string;
  region?: string | null;
  version?: number | null;
};

export function InstancesTable({ items }: { items: InstanceItem[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.ownerSlUuid.toLowerCase().includes(q) || i.status.toLowerCase().includes(q));
  }, [items, query]);

  return (
    <div className="space-y-3">
      <Input placeholder="Filter by owner UUID or status" value={query} onChange={(e) => setQuery(e.target.value)} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Owner UUID</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Region</TableHead>
            <TableHead>Version</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered?.length ? (
            filtered.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-mono text-xs">{m.ownerSlUuid}</TableCell>
                <TableCell>{m.status}</TableCell>
                <TableCell className="text-muted-foreground">{m.region || "–"}</TableCell>
                <TableCell>{m.version ?? "–"}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                No instances found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
