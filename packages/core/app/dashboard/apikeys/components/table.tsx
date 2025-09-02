"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";

export type ApiKeyItem = {
  id: string;
  name?: string;
  createdAt?: string;
  lastUsedAt?: string | null;
};

export function ApiKeysTable({ items }: { items: ApiKeyItem[] }) {
  const [filter, setFilter] = useState("");
  const filtered = items.filter((k) => (k.name || "").toLowerCase().includes(filter.toLowerCase()) || k.id.includes(filter));
  return (
    <div className="space-y-3">
      <Input placeholder="Filter by name or ID" value={filter} onChange={(e) => setFilter(e.target.value)} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Key ID</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Last Used</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered?.length ? (
            filtered.map((k) => (
              <TableRow key={k.id}>
                <TableCell>{k.name || "–"}</TableCell>
                <TableCell className="font-mono text-xs">{k.id}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{k.createdAt ? new Date(k.createdAt).toLocaleString() : "–"}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "–"}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">No API keys.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
