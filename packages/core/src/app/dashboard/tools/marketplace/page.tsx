import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function MarketplaceTool() {
  redirect("/dashboard/tools/marketplace/explorer");
}
