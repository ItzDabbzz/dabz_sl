import Link from "next/link";
import ExplorerClient from "./components/ExplorerClient";
import { getOptionalSession } from "@/server/auth/session";

export const dynamic = "force-dynamic";

/**
 * Marketplace Explorer page (Server Component)
 * - Auth-gated; renders the interactive client explorer when signed in.
 */
export default async function ExplorerPage() {
    const session = await getOptionalSession();

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">
                    Marketplace Explorer
                </h1>
                <p className="text-muted-foreground">
                    Browse, filter, and organize marketplace items. Use the
                    category picker per item to assign categories.
                </p>
            </div>

            {!session?.user ? (
                <div className="rounded-lg border p-6">
                    <p className="mb-3 text-sm text-muted-foreground">
                        You need to sign in to use this tool.
                    </p>
                    <Link href="/" className="text-sm underline">
                        Go to home to sign in
                    </Link>
                </div>
            ) : (
                <div className="rounded-lg border p-4 space-y-4">
                    <ExplorerClient />
                </div>
            )}
        </div>
    );
}
