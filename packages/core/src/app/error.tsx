"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Surface the error for observability tools
        // TODO: wire up Sentry/LogRocket/etc. here if configured
        // eslint-disable-next-line no-console
        console.error(error);
    }, [error]);

    return (
        <div className="min-h-[70vh] w-full px-6 py-16 flex items-center justify-center bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-muted/30 via-background to-background">
            <div className="mx-auto max-w-2xl text-center space-y-6">
                <div className="mx-auto h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center text-2xl">!</div>
                <div className="space-y-2">
                    <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
                        Something went wrong
                    </h1>
                    <p className="text-muted-foreground">
                        An unexpected error occurred while rendering this page.
                        You can try again or head back home.
                    </p>
                    {error?.digest && (
                        <p className="text-xs text-muted-foreground/80">
                            Error ID:{" "}
                            <span className="font-mono">{error.digest}</span>
                        </p>
                    )}
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                        onClick={() => reset()}
                        className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium border"
                    >
                        Try again
                    </button>
                    <Link
                        href="/"
                        className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium border"
                    >
                        Go home
                    </Link>
                    <Link
                        href="/feedback"
                        className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium border"
                    >
                        Report issue
                    </Link>
                </div>
                {process.env.NODE_ENV === "development" && (
                    <pre className="text-left mt-6 overflow-auto rounded-md border bg-muted/40 p-4 text-xs leading-relaxed">
                        {String(error?.stack || error?.message || "")}
                    </pre>
                )}
            </div>
        </div>
    );
}
