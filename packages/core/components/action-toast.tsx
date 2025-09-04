"use client";

import * as React from "react";
import { toast } from "sonner";

export function ActionToast({ ok }: { ok?: string }) {
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
    toast(msg);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("ok");
      window.history.replaceState({}, "", url.toString());
    } catch {}
  }, [ok]);
  return null;
}
