import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { and, eq, sql } from "drizzle-orm";
import { blogPostRatings, blogPosts } from "@/schemas/blog";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

function getIp(req: NextRequest) {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0].trim();
    const xrip = req.headers.get("x-real-ip");
    if (xrip) return xrip;
    // NextRequest.ip may not exist in edge; headers fallback above should be enough
    return "unknown";
}

async function getUserIdOrAnon(req: NextRequest) {
    // Try session user
    try {
        const ses = await auth.api.getSession({ headers: req.headers as any });
        const uid = (ses as any)?.user?.id as string | undefined;
        if (uid)
            return {
                userId: uid,
                setAnon: null as null | { name: string; value: string },
            };
    } catch {}

    // Fallback to anon cookie
    const cookies = req.cookies;
    const existing = cookies.get("anonId")?.value;
    if (existing) return { userId: existing, setAnon: null };
    const anon = crypto.randomUUID();
    return { userId: anon, setAnon: { name: "anonId", value: anon } };
}

async function ensurePostExists(postId: string) {
    const [p] = await db
        .select({ id: blogPosts.id })
        .from(blogPosts)
        .where(and(eq(blogPosts.id, postId), eq(blogPosts.published, true)))
        .limit(1);
    return !!p;
}

export async function GET(
    req: NextRequest,
    ctx: { params: Promise<{ postId: string }> },
) {
    const { postId } = await ctx.params;
    if (!postId) return new NextResponse("missing_post", { status: 400 });

    // Optional user id (for userScore)
    const { userId } = await getUserIdOrAnon(req);

    // aggregates
    const [row] = await db
        .select({
            avg: sql<number>`coalesce(avg(${blogPostRatings.score})::float, 0)`,
            count: sql<number>`count(*)::int`,
        })
        .from(blogPostRatings)
        .where(eq(blogPostRatings.postId, postId));

    let userScore: number | null = null;
    if (userId) {
        const [ur] = await db
            .select({ score: blogPostRatings.score })
            .from(blogPostRatings)
            .where(
                and(
                    eq(blogPostRatings.postId, postId),
                    eq(blogPostRatings.userId, userId),
                ),
            )
            .limit(1);
        userScore = ur?.score ?? null;
    }

    return NextResponse.json({
        average: Number(row?.avg ?? 0),
        count: Number(row?.count ?? 0),
        userScore,
    });
}

export async function POST(
    req: NextRequest,
    ctx: { params: Promise<{ postId: string }> },
) {
    const { postId } = await ctx.params;
    if (!postId) return new NextResponse("missing_post", { status: 400 });

    // Basic rate limit: 10/min per IP per post
    const ip = getIp(req);
    const rl = await rateLimit(`rating:${postId}:${ip}`, 10, 60_000);
    if (!rl.ok) {
        return new NextResponse("rate_limited", {
            status: 429,
            headers: {
                "Retry-After": String(
                    Math.ceil((rl.retryAfterMs ?? 1000) / 1000),
                ),
            },
        });
    }

    const { userId, setAnon } = await getUserIdOrAnon(req);

    // Validate post existence
    if (!(await ensurePostExists(postId)))
        return new NextResponse("not_found", { status: 404 });

    // Read score
    let score: number | undefined;
    try {
        const body = await req.json();
        score = Number(body?.score);
    } catch {
        return new NextResponse("invalid_json", { status: 400 });
    }
    if (!Number.isInteger(score) || score! < 1 || score! > 10) {
        return new NextResponse("invalid_score", { status: 400 });
    }

    // Upsert unique per (postId, userId)
    await db
        .insert(blogPostRatings)
        .values({ postId, userId, score: score! })
        .onConflictDoUpdate({
            target: [blogPostRatings.postId, blogPostRatings.userId],
            set: { score: score!, updatedAt: new Date() },
        });

    // Return fresh aggregates
    const [row] = await db
        .select({
            avg: sql<number>`coalesce(avg(${blogPostRatings.score})::float, 0)`,
            count: sql<number>`count(*)::int`,
        })
        .from(blogPostRatings)
        .where(eq(blogPostRatings.postId, postId));

    const res = NextResponse.json({
        average: Number(row?.avg ?? 0),
        count: Number(row?.count ?? 0),
        userScore: score,
    });
    if (setAnon) {
        res.cookies.set(setAnon.name, setAnon.value, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: 60 * 60 * 24 * 365, // 1 year
        });
    }
    return res;
}
