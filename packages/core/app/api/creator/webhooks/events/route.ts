import { NextResponse } from "next/server";

const presets = [
  { group: "Config", items: ["config.updated", "snapshot.created", "snapshot.restored"] },
  { group: "Objects", items: ["object.created", "object.updated", "object.deleted"] },
  { group: "Marketplace", items: ["marketplace.item.created", "marketplace.item.updated"] },
  { group: "Test", items: ["test.ping", "test.event"] },
];

export async function GET() {
  return NextResponse.json({ groups: presets });
}
