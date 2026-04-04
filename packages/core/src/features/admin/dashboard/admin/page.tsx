import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth/core";
import AdminDashboard from "./AdminDashboard";
import { AppQueryProvider } from "@/components/providers/app-query-provider";

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.session) {
    redirect("/sign-in");
  }
  const role = (session as any)?.user?.role ?? "user";
  const allowed = new Set(["owner", "developer", "admin"]);
  if (!allowed.has(role)) {
    redirect("/dashboard");
  }
  return (
    <AppQueryProvider>
      <AdminDashboard />
    </AppQueryProvider>
  );
}
