import RequestsClient from "./components/RequestsClient";
import { DashboardPage } from "@/features/dashboard/components/page";
import { StaffOnly } from "@/features/dashboard/components/staff-only";

export const dynamic = "force-dynamic";

export default async function Page() {
  return (
    <DashboardPage
      title="Marketplace Requests"
      description="Review public submissions and approve to add them to your items."
      crumbs={[
        { label: "Console", href: "/dashboard" },
        { label: "Marketplace" },
        { label: "Requests" },
      ]}
    >
      <StaffOnly
        deniedDescription="Reviewing marketplace requests is for staff."
      >
        <RequestsClient />
      </StaffOnly>
    </DashboardPage>
  );
}
