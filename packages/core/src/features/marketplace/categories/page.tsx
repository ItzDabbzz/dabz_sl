import Link from "next/link";
import CategoriesEditor from "./components/CategoriesEditor";
import { DashboardPage } from "@/features/dashboard/components/page";
import { StaffOnly } from "@/features/dashboard/components/staff-only";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  return (
    <DashboardPage
      title="Marketplace Categories"
      description="Organise scraped items into a tree. Drag a category onto another to nest it, or onto the top-level strip to promote it."
      crumbs={[
        { label: "Console", href: "/dashboard" },
        { label: "Marketplace" },
        { label: "Categories" },
      ]}
    >
      <StaffOnly
        deniedDescription="Managing the marketplace catalogue is for staff."
      >
        <CategoriesEditor />
      </StaffOnly>
    </DashboardPage>
  );
}
