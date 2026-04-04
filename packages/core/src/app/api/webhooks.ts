
import type { NextApiRequest, NextApiResponse } from "next";
import { WebhookPayloadSchema } from "@/schemas/webhook";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parseResult = WebhookPayloadSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Invalid payload", details: parseResult.error.message });
  }

  // Do something with parseResult.data
  console.log("Webhook received:", parseResult.data);
  return res.status(200).json({ success: true });
}