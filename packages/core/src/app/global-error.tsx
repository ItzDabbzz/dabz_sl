"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { OctagonAlert, Home } from "lucide-react";

// Catches errors in the root layout (outside page boundaries)
export default function GlobalError({
    error,
    reset,
}: {
    error: Error;
    reset: () => void;
}) {
    useEffect(() => {
        // eslint-disable-next-line no-console
        console.error("Global error:", error);
    }, [error]);

    return (
        <html>
            <body>
                <div className="min-h-screen w-full px-6 py-16 flex items-center justify-center bg-background">
                    <div className="mx-auto max-w-2xl text-center space-y-6">
                        <div className="mx-auto h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                            <OctagonAlert className="h-8 w-8 text-destructive" />
                        </div>
                        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
                            Critical application error
                        </h1>
                        <p className="text-muted-foreground">
                            An unrecoverable error occurred. Try reloading the
                            app or go back to the homepage.
                        </p>
                        <div className="flex items-center justify-center gap-3">
                            <Button onClick={() => reset()}>Reload</Button>
                            <Button asChild variant="outline" className="gap-2">
                                <Link href="/">
                                    <Home className="h-4 w-4" /> Home
                                </Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </body>
        </html>
    );
}
