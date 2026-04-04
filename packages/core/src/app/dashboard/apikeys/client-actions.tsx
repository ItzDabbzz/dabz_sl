"use client";

import { startTransition, useOptimistic } from "react";
import { toast } from "sonner";

export function UseApiKeyActions({
  onRevoke,
  onCreate,
  children,
}: {
  onRevoke: (form: FormData) => Promise<Response | void>;
  onCreate: (form: FormData) => Promise<Response | void>;
  children: (actions: {
    submitRevoke: (form: HTMLFormElement) => void;
    submitCreate: (form: HTMLFormElement) => void;
  }) => React.ReactNode;
}) {
  const [, setTick] = useOptimistic(0, (x) => x + 1);

  function handle(fetcher: (fd: FormData) => Promise<Response | void>) {
    return (form: HTMLFormElement) => {
      const fd = new FormData(form);
      startTransition(async () => {
        try {
          const res = (await fetcher(fd)) as Response | void;
          if (res && !res.ok) {
            const data = await res.json().catch(() => ({}));
            const msg = data?.error || data?.message || res.statusText || "Request failed";
            toast.error(msg, { description: data?.reason });
          } else {
            toast.success("Saved");
          }
          setTick(0);
        } catch (err: any) {
          toast.error("Network error", { description: err?.message });
        }
      });
    };
  }

  return <>{children({ submitRevoke: handle(onRevoke), submitCreate: handle(onCreate) })}</>;
}
