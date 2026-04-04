import { headers as nextHeaders } from "next/headers";
import { auth } from "@/lib/auth";

type HeaderCarrier = {
    headers: Headers;
};

export async function getSessionFromRequest(input: HeaderCarrier) {
    return auth.api.getSession({ headers: input.headers as any });
}

export async function getOptionalSession() {
    try {
        return await auth.api.getSession({ headers: await nextHeaders() });
    } catch {
        return null;
    }
}

export async function requireUserFromRequest(input: HeaderCarrier) {
    const session = await getSessionFromRequest(input);
    if (!session?.user) {
        throw new Error("unauthorized");
    }

    return session.user;
}

export async function requireUser() {
    const session = await getOptionalSession();
    if (!session?.user) {
        throw new Error("unauthorized");
    }

    return session.user;
}
