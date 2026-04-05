import { NextRequest, NextResponse } from "next/server";
import { WebhookPayloadSchema } from "@/schemas/webhook";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parseResult = WebhookPayloadSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parseResult.error.message },
      { status: 400 }
    );
  }

  // TODO: implement webhook processing logic
  return NextResponse.json({ success: true });
}
