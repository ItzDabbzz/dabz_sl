import { auth } from "@/server/auth/core";

export type CreatorContext = {
  userId: string;
  scopes: string[];
  targets?: { orgId?: string; teamId?: string; masterObjectId?: string };
  // True when authenticated via first-party cookie (no Bearer header)
  firstParty?: boolean;
};

// Extract scopes/targets from Better Auth API key session
export async function getCreatorContextFromApiKey(request: Request): Promise<CreatorContext> {
  const header = request.headers.get("authorization") || "";
  const m = header.match(/^Bearer\s+(.+)$/i);

  // Prefer bearer, but allow cookie session for first-party calls
  let ses: any;
  if (m) {
    ses = await auth.api.getSession({ headers: { Authorization: header } as any });
    if (!ses?.user) throw new Error("missing_bearer");
  } else {
    const h: any = {};
    request.headers.forEach((v, k) => (h[k] = v));
    ses = await auth.api.getSession({ headers: h });
    if (!ses?.user) throw new Error("missing_bearer");
  }

  const user: any = ses.user;
  const meta = user?.metadata || {};

  // Pull scopes from user.permissions or metadata.permissions (string or array)
  let scopes: string[] = [];
  const p = user?.permissions ?? meta?.permissions;
  if (typeof p === "string") scopes = p.split(" ").filter(Boolean);
  else if (Array.isArray(p)) scopes = p.filter(Boolean);

  const targets = {
    orgId: meta.orgId,
    teamId: meta.teamId,
    masterObjectId: meta.masterObjectId,
  } as CreatorContext["targets"];

  return { userId: user.id, scopes, targets, firstParty: !m };
}

export function requireScope(ctx: CreatorContext, scope: string) {
  // Allow first-party authenticated dashboard calls even if explicit scopes are not set
  if (ctx.firstParty) return;
  if (ctx.scopes.includes("*")) return;
  if (!ctx.scopes.includes(scope)) throw new Error("forbidden");
}
