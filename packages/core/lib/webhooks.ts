import { createHmac } from "crypto";
import { db } from "@/lib/db";
import { webhookDeliveries } from "@/schemas/sl-schema";

export function signWebhook(secret: string, body: string, timestamp: string) {
  const msg = `${timestamp}.${body}`;
  const sig = createHmac("sha256", secret).update(msg).digest("hex");
  return sig;
}

export async function deliverWebhook(params: {
  url: string;
  event: string;
  payload: unknown;
  secret?: string;
  webhookId?: string | null;
}) {
  const { url, event, payload, secret, webhookId } = params;
  const bodyObj = { event, data: payload, ts: new Date().toISOString() };
  const body = JSON.stringify(bodyObj);
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (secret) {
    const ts = Math.floor(Date.now() / 1000).toString();
    const sig = signWebhook(secret, body, ts);
    headers["X-Webhook-Timestamp"] = ts;
    headers["X-Webhook-Signature"] = `sha256=${sig}`;
  }

  const start = Date.now();
  let status = 0;
  let resBody = "";
  let error: string | null = null;
  try {
    const res = await fetch(url, { method: "POST", headers, body });
    status = res.status;
    resBody = (await res.text()).slice(0, 2048);
  } catch (e: any) {
    error = e?.message || String(e);
  }
  const durationMs = Date.now() - start;

  const [record] = await db
    .insert(webhookDeliveries)
    .values({
      webhookId: (webhookId || null) as any,
      targetUrl: url,
      event,
      requestJson: bodyObj as any,
      responseStatus: status || null,
      responseBody: resBody || null,
      error: error || null,
      signature: secret ? headers["X-Webhook-Signature"] : null,
      durationMs,
    })
    .returning({ id: webhookDeliveries.id });

  return { id: record?.id, status, ok: !!status && status >= 200 && status < 300, durationMs };
}
