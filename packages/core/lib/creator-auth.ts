import { auth } from "@/lib/auth";

export type CreatorContext = {
  userId: string;
  scopes: string[];
  targets?: { orgId?: string; teamId?: string; masterObjectId?: string };
};

// Extract scopes/targets from Better Auth API key session
export async function getCreatorContextFromApiKey(request: Request): Promise<CreatorContext> {
  const header = request.headers.get("authorization") || "";
  const m = header.match(/^Bearer\s+(.+)$/i);

  // Prefer bearer, but allow cookie session for first-party calls
  let ses: any;
  if (m) {
    ses = await auth.api.getSession({ headers: { Authorization: header } as any });
    if (!ses?.session) throw new Error("invalid_bearer");
  } else {
    const h: any = {};
    request.headers.forEach((v, k) => (h[k] = v));
    ses = await auth.api.getSession({ headers: h });
    if (!ses?.session) throw new Error("missing_bearer");
  }

  const scopes: string[] = (ses.session.user as any)?.permissions?.split?.(" ") || [];
  const meta = (ses.session.user as any)?.metadata || {};
  const targets = {
    orgId: meta.orgId,
    teamId: meta.teamId,
    masterObjectId: meta.masterObjectId,
  } as CreatorContext["targets"];

  return { userId: ses.session.user.id, scopes, targets };
}

export function requireScope(ctx: CreatorContext, scope: string) {
  if (!ctx.scopes.includes(scope)) throw new Error("forbidden");
}
