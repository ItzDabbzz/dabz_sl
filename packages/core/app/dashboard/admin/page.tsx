import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import AdminDashboard from "./AdminDashboard";

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
  return <AdminDashboard />;
}
