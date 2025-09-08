"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ApiKeyItem } from "./components/table";

export function ActionsClient({ items }: { items: ApiKeyItem[] }) {
  const router = useRouter();

  async function revoke(id: string) {
    const res = await fetch(`/api/creator/apikeys?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data?.error || res.statusText || "Failed to revoke", { description: data?.reason });
    } else {
      toast.success("Key revoked");
    }
  }

  async function create(name: string, scopesRaw: string) {
    const scopes = scopesRaw.split(/\s+/).filter(Boolean);
    const res = await fetch(`/api/creator/apikeys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, scopes }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data?.error || res.statusText || "Failed to create key", { description: data?.reason });
    } else {
      toast.success("Key created");
    }
  }

  return (
    <>
      <div className="mt-4 space-y-2">
        {items.map((k) => (
          <form
            key={k.id}
            onSubmit={async (e) => {
              e.preventDefault();
              const id = (e.currentTarget.elements.namedItem("id") as HTMLInputElement)?.value || "";
              await revoke(id);
              router.refresh();
            }}
            className="flex items-center justify-between border rounded-md p-2"
          >
            <div className="text-xs text-muted-foreground truncate">
              Revoke key <span className="font-mono">{k.id}</span>
            </div>
            <input type="hidden" name="id" value={k.id} />
            <Button variant="destructive" size="sm" type="submit">Revoke</Button>
          </form>
        ))}
      </div>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const name = (e.currentTarget.elements.namedItem("name") as HTMLInputElement)?.value || "New Key";
          const scopes = (e.currentTarget.elements.namedItem("scopes") as HTMLInputElement)?.value || "";
          await create(name, scopes);
          (e.currentTarget as HTMLFormElement).reset();
          router.refresh();
        }}
        className="w-full grid gap-3 md:grid-cols-[1fr_1fr_auto]"
      >
        <Input name="name" placeholder="Key name" />
        <Input name="scopes" placeholder="Scopes (space separated) e.g. sl.objects:read sl.instances:write" />
        <Button type="submit">Create</Button>
      </form>
    </>
  );
}
