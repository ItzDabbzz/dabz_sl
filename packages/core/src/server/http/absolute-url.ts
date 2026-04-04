export function absoluteUrl(h: Headers): string {
  const candidate =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL ||
    process.env.VERCEL_URL;

  if (candidate) {
    const hasProtocol = /^https?:\/\//i.test(candidate);
    const base = hasProtocol ? candidate : `https://${candidate}`;
    return base.replace(/\/$/, "");
  }

  const proto = h.get("x-forwarded-proto") || (process.env.NODE_ENV === "production" ? "https" : "http");
  const host = h.get("x-forwarded-host") || h.get("host");
  if (host) return `${proto}://${host}`.replace(/\/$/, "");
  return "http://localhost:3000";
}
