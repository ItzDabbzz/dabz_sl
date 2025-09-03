import { z } from "zod";

export const WebhookPayloadSchema = z.object({
  event: z.string().meta({ description: "Event type" }),
  data: z.unknown().meta({ description: "Event payload" }),
}).meta({ description: "Generic webhook payload" });
