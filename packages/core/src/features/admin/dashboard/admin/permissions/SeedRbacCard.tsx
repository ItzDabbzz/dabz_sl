"use client";
import { useRef, useState } from "react";
import { toast } from "sonner";
import OrgTeamPicker from "@/features/admin/components/pickers/org-team-picker";
import { Button } from "@/components/ui/button";

export function SeedRbacCard() {
  const formRef = useRef<HTMLFormElement>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSeed(e: React.FormEvent) {
    e.preventDefault();
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    const raw = (fd.get("orgIds") as string | null) || "";
    const ids = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (ids.length === 0) {
      toast("Select one or more organizations first");
      return;
    }

    setSubmitting(true);
    try {
      let okCount = 0;
      let failCount = 0;
      for (const id of ids) {
        const res = await fetch("/api/admin/rbac/seed-org", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizationId: id }),
        });
        if (res.ok) okCount++; else failCount++;
      }
      if (okCount > 0) {
        toast(`${okCount} organization${okCount > 1 ? "s" : ""} seeded`);
      }
      if (failCount > 0) {
        toast(`Failed on ${failCount} organization${failCount > 1 ? "s" : ""}`);
      }
    } catch {
      toast("Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold">Seed RBAC</div>
          <div className="text-sm text-muted-foreground">
            Select organizations to seed default roles and grants. Teams are ignored.
          </div>
        </div>
      </div>
      <form ref={formRef} onSubmit={onSeed} className="space-y-3">
        <OrgTeamPicker nameOrg="orgIds" labelOrg="Organizations to seed" preferTeamPicker={false} />
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Seeding..." : "Seed selected orgs"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default SeedRbacCard;
