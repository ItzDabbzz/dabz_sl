import { headers as nextHeaders } from "next/headers";
import { absoluteUrl } from "@/server/http/absolute-url";

function requestOriginFromHeaders(source: Headers): string | null {
    const proto = source.get("x-forwarded-proto") || source.get("x-forwarded-protocol");
    const host = source.get("x-forwarded-host") || source.get("host");

    if (!host) {
        return null;
    }

    return `${proto || "http"}://${host}`.replace(/\/$/, "");
}

function buildInternalApiHeaders(source: Headers) {
    const requestHeaders = new Headers();
    const cookie = source.get("cookie");
    const authorization = source.get("authorization");
    const apiKey = source.get("x-api-key");

    if (cookie) {
        requestHeaders.set("cookie", cookie);
    }

    if (authorization) {
        requestHeaders.set("authorization", authorization);
    }

    if (apiKey) {
        requestHeaders.set("x-api-key", apiKey);
    }

    return requestHeaders;
}

export async function fetchInternalApi(
    path: string,
    init?: RequestInit,
) {
    const incomingHeaders = await nextHeaders();
    const base = requestOriginFromHeaders(incomingHeaders) || absoluteUrl(incomingHeaders);
    const headers = buildInternalApiHeaders(incomingHeaders);

    if (init?.headers) {
        new Headers(init.headers).forEach((value, key) => {
            headers.set(key, value);
        });
    }

    const normalizedPath = path.startsWith("/") ? path : `/${path}`;

    return fetch(`${base}${normalizedPath}`, {
        ...init,
        headers,
    });
}

export async function fetchInternalApiJson<T>(
    path: string,
    fallback: T,
    init?: RequestInit,
): Promise<T> {
    const response = await fetchInternalApi(path, init);
    if (!response.ok) {
        return fallback;
    }

    return response.json().catch(() => fallback);
}
