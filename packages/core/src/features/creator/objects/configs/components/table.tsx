"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type ConfigItem = {
  id: string;
  instanceId: string;
  createdAt?: string;
  versionTag?: string | null;
};

export function ConfigsTable({ items }: { items: ConfigItem[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Instance</TableHead>
          <TableHead>Version Tag</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items?.length ? (
          items.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-mono text-xs">{c.instanceId}</TableCell>
              <TableCell>{c.versionTag || "–"}</TableCell>
              <TableCell className="text-muted-foreground text-xs">{c.createdAt ? new Date(c.createdAt).toLocaleString() : "–"}</TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">No configs.</TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
