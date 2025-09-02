"use client";

import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type MasterObject = {
  id: string;
  name: string;
  description?: string | null;
  currentVersion: number;
};

export function MasterObjectsTable({ items }: { items: MasterObject[] }) {
  const router = useRouter();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Version</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items?.length ? (
          items.map((m) => (
            <TableRow key={m.id} className="cursor-pointer hover:bg-muted/40" onClick={() => router.push(`/dashboard/objects/${m.id}`)}>
              <TableCell className="font-medium">{m.name}</TableCell>
              <TableCell className="text-muted-foreground">{m.description || "–"}</TableCell>
              <TableCell>{m.currentVersion}</TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
              No master objects yet.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
