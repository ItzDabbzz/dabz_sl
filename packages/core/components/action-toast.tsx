"use client";

import * as React from "react";
import { useToast } from "@/hooks/use-toast";

export function ActionToast({ ok }: { ok?: string }) {
  const { toast } = useToast();
  React.useEffect(() => {
    if (!ok) return;
    const map: Record<string, string> = {
      details: "Details saved",
      schema: "Schema saved",
      defaults: "Defaults saved",
      builder: "Configuration saved",
      version: "Version created",
      current: "Current version updated",
    };
    const msg = map[ok] || "Saved";
    toast({ title: msg });
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("ok");
      window.history.replaceState({}, "", url.toString());
    } catch {}
  }, [ok, toast]);
  return null;
}
