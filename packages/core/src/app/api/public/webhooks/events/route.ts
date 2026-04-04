export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

export async function GET() {
  const groups = [
    {
      name: "Config",
      events: [
        "config.updated",
        "snapshot.created",
        "snapshot.restored",
      ],
    },
    {
      name: "Instances",
      events: [
        "instance.created",
        "instance.updated",
        "instance.deleted",
      ],
    },
    {
      name: "Entitlements",
      events: [
        "entitlement.granted",
        "entitlement.revoked",
      ],
    },
    {
      name: "System",
      events: [
        "webhook.test",
        "webhook.delivery.failed",
        "webhook.delivery.succeeded",
      ],
    },
  ];

  return NextResponse.json({
    groups,
    all: groups.flatMap((g) => g.events),
  });



}
