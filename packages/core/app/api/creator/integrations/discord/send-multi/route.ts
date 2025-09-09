import { NextRequest, NextResponse } from "next/server";
import { getCreatorContextFromApiKey, requireScope } from "@/lib/creator-auth";

function isDiscordWebhookUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      (u.hostname === "discord.com" || u.hostname === "discordapp.com") &&
      u.pathname.startsWith("/api/webhooks/")
    );
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getCreatorContextFromApiKey(req as any);
    requireScope(ctx, "sl.webhooks:write");

    const { urls, payload } = await req.json();
    if (!Array.isArray(urls) || urls.length === 0) return NextResponse.json({ error: "no_urls" }, { status: 400 });
    const safe = urls.filter((u: string) => isDiscordWebhookUrl(u));
    if (safe.length === 0) return NextResponse.json({ error: "invalid_urls" }, { status: 400 });

    const results = await Promise.all(
      safe.map(async (u: string) => {
        try {
          const r = await fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload ?? {}) });
          const text = await r.text();
          return { url: u, ok: r.ok, status: r.status, body: text };
        } catch (e: any) {
          return { url: u, ok: false, status: 0, body: e?.message || "error" };
        }
      }),
    );
    return NextResponse.json({ results }, { status: 200 });
  } catch (e: any) {
    if (e?.message?.includes("missing_bearer")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (e?.message?.includes("forbidden")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
