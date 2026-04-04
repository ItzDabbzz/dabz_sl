import { headers as nextHeaders } from "next/headers";
import { absoluteUrl } from "@/lib/absolute-url";

function buildInternalApiHeaders(source: Headers) {
    const requestHeaders = new Headers();
    const cookie = source.get("cookie");

    if (cookie) {
        requestHeaders.set("cookie", cookie);
    }

    return requestHeaders;
}

export async function fetchInternalApi(
    path: string,
    init?: RequestInit,
) {
    const incomingHeaders = await nextHeaders();
    const base = absoluteUrl(incomingHeaders);
    const headers = buildInternalApiHeaders(incomingHeaders);

    if (init?.headers) {
        new Headers(init.headers).forEach((value, key) => {
            headers.set(key, value);
        });
    }

    return fetch(`${base}${path}`, {
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
    return response.json().catch(() => fallback);
}
