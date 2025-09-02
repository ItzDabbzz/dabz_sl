export function absoluteUrl(h: Headers): string {
  const env = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || process.env.VERCEL_URL;
  if (env) {
    const hasProtocol = /^https?:\/\//i.test(env);
    const base = hasProtocol ? env : `https://${env}`;
    return base.replace(/\/$/, "");
  }
  const proto = h.get("x-forwarded-proto") || (process.env.NODE_ENV === "production" ? "https" : "http");
  const host = h.get("x-forwarded-host") || h.get("host");
  if (host) return `${proto}://${host}`.replace(/\/$/, "");
  return "http://localhost:3000";
}
