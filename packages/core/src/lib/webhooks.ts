import { createHmac } from "crypto";
import { db } from "@/lib/db";
import { webhookDeliveries, webhookDestinations } from "@/schemas/sl-schema";
import { and, eq } from "drizzle-orm";

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
      transport: "http",
      durationMs,
    })
    .returning({ id: webhookDeliveries.id });

  return { id: record?.id, status, ok: !!status && status >= 200 && status < 300, durationMs };
}

// Fan-out helper: deliver to webhook's additional destinations (e.g., Discord)
export async function deliverToDestinations(params: {
  webhookId: string;
  event: string;
  payload: unknown;
}) {
  const { webhookId, event, payload } = params;
  // Load enabled destinations for this webhook
  const dests = await db
    .select()
    .from(webhookDestinations)
    .where(and(eq(webhookDestinations.webhookId, webhookId), eq(webhookDestinations.enabled, true)));

  const matchesEvent = (events: any) => {
    const list = Array.isArray(events) ? events : [];
    if (!list.length) return true; // empty means all
    return list.some((pat) => {
      if (pat === "*") return true;
      if (pat === event) return true;
      // simple wildcard suffix match: order.created.*
      if (pat.endsWith(".*")) {
        const p = pat.slice(0, -2);
        return event.startsWith(p + ".");
      }
      return false;
    });
  };

  const results: Array<{ id?: string; ok: boolean; status?: number; error?: string }> = [];
  for (const d of dests) {
    if (!matchesEvent((d as any).events)) continue;
    try {
      if ((d as any).type === "discord") {
        const cfg = (d as any).configJson || {};
        const urls: string[] = Array.isArray(cfg.urls) ? cfg.urls : cfg.url ? [cfg.url] : [];
        const payloadJson = cfg.payloadJson || { content: JSON.stringify({ event, data: payload }).slice(0, 1900) };
        for (const u of urls) {
          const start = Date.now();
          let status = 0;
          let resBody = "";
          let error: string | null = null;
          try {
            const res = await fetch(u, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payloadJson),
            });
            status = res.status;
            resBody = (await res.text()).slice(0, 2048);
          } catch (e: any) {
            error = e?.message || String(e);
          }
          const durationMs = Date.now() - start;
          const [rec] = await db
            .insert(webhookDeliveries)
            .values({
              webhookId: webhookId as any,
              destinationId: (d as any).id,
              targetUrl: u,
              event,
              requestJson: payloadJson as any,
              responseStatus: status || null,
              responseBody: resBody || null,
              error: error || null,
              signature: null,
              transport: "discord",
              durationMs,
            })
            .returning({ id: webhookDeliveries.id });
          results.push({ id: rec?.id, ok: !!status && status >= 200 && status < 300, status, error: error || undefined });
        }
      }
      // Additional destination types can be added here
    } catch (e: any) {
      results.push({ ok: false, error: e?.message || String(e) });
    }
  }

  return results;
}
