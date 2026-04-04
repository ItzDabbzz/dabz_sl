"use client";

import { useEffect, useState } from "react";

// Client-side helper to evaluate a permission via a lightweight API call.
// Minimizes client bundle by not importing server-only code.
export function useCan(permissionKey: string) {
  const [allowed, setAllowed] = useState<boolean>(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/auth/can?key=${encodeURIComponent(permissionKey)}`, { cache: "no-store" });
        if (!res.ok) throw new Error("bad");
        const data = await res.json();
        if (alive) setAllowed(!!data.allowed);
      } catch {
        if (alive) setAllowed(false);
      }
    })();
    return () => { alive = false; };
  }, [permissionKey]);
  return allowed;
}
