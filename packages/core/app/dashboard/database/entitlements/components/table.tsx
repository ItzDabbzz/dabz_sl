"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type EntitlementItem = {
  id: string;
  ownerSlUuid: string;
  masterObjectId: string;
  source: string;
  createdAt?: string;
};

export function EntitlementsTable({ items }: { items: EntitlementItem[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Owner</TableHead>
          <TableHead>Object</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items?.length ? (
          items.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="font-mono text-xs">{e.ownerSlUuid}</TableCell>
              <TableCell className="font-mono text-xs">{e.masterObjectId}</TableCell>
              <TableCell>{e.source}</TableCell>
              <TableCell className="text-muted-foreground text-xs">{e.createdAt ? new Date(e.createdAt).toLocaleString() : "–"}</TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">No entitlements.</TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
