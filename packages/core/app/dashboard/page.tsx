import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session) return redirect("/sign-in");

  const Item = ({ href, title, desc }: { href: string; title: string; desc: string }) => (
    <Link href={href} className="block">
      <Card className="transition-colors hover:bg-muted/40">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{desc}</p>
        </CardContent>
      </Card>
    </Link>
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Platform Dashboard</h1>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Item href="/dashboard/objects" title="Master Objects" desc="Create and manage templates" />
        <Item href="/dashboard/instances" title="Instances" desc="Search and monitor instances" />
        <Item href="/dashboard/configs" title="Configs" desc="View histories and diffs" />
        <Item href="/dashboard/entitlements" title="Entitlements" desc="Track purchases/deliveries" />
        <Item href="/dashboard/apikeys" title="API Keys" desc="Create, scope, revoke" />
        <Item href="/dashboard/webhooks" title="Webhooks" desc="Manage and inspect deliveries" />
      </div>
    </div>
  );
}
