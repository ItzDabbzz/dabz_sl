"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import ScopeSelector from "@/features/creator/objects/components/scope-selector";
import { defaultScopeOptions } from "@/features/creator/objects/components/scope-options";
export function ActionsClient() {
  const router = useRouter();
  const [scopes, setScopes] = React.useState<string[]>([]);
  const [open, setOpen] = React.useState(false);

  const [revealed, setRevealed] = React.useState<{ id?: string; key?: string; prefix?: string } | null>(null);

  async function create(name: string, scopesRaw: string) {
    const scopes = scopesRaw.split(/\s+/).filter(Boolean);
    const confirmStar = scopes.includes("*") && scopes.filter((s) => s !== "*").length > 0;
    const res = await fetch(`/api/creator/apikeys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, scopes, confirmStar }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data?.error || res.statusText || "Failed to create key", { description: data?.reason });
    } else {
      const data = await res.json().catch(() => ({}));
      // If the API returns key material, show it once
      if (data?.key || data?.apiKey?.key) {
        setRevealed({ id: data?.id || data?.apiKey?.id, key: data?.key || data?.apiKey?.key, prefix: data?.prefix || data?.apiKey?.prefix });
        toast.success("Key created. Copy it now — you won't be able to see it again.");
      } else {
        toast.success("Key created");
      }
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setScopes([]);
          setRevealed(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>New API Key</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create API Key</DialogTitle>
        </DialogHeader>
        {revealed ? (
          <div className="rounded border p-3 text-sm">
            <div className="font-medium mb-1">New API Key</div>
            <div className="font-mono break-all">{revealed.key}</div>
            <div className="text-muted-foreground mt-1">Copy this now — it won't be shown again.</div>
          </div>
        ) : (
          <form
            id="create-key-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const name = (e.currentTarget.elements.namedItem("name") as HTMLInputElement)?.value || "New Key";
              const scopesRaw = (e.currentTarget.elements.namedItem("scopes") as HTMLInputElement)?.value || "";
              await create(name, scopesRaw);
              // Guard against null reset in some synthetic events
              const form = e.currentTarget as HTMLFormElement | null;
              form?.reset?.();
              setScopes([]);
              router.refresh();
            }}
            className="grid gap-4"
          >
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input name="name" placeholder="Key name" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Permissions</label>
              <ScopeSelector options={defaultScopeOptions} value={scopes} onChange={(arr) => setScopes(arr)} />
              {/* Preserve server contract: submit as space-separated string */}
              <input type="hidden" name="scopes" value={scopes.join(" ")} />
            </div>
          </form>
        )}
        <DialogFooter>
          {revealed ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setRevealed(null);
                  setOpen(false);
                }}
              >
                Close
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" form="create-key-form">Create</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
