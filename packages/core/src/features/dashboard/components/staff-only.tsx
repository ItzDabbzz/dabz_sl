import Link from "next/link";
import { ReactNode } from "react";
import { getOptionalSession } from "@/server/auth/session";
import { isStaffUser } from "@/features/auth/permissions/staff";

/**
 * The staff-only part of a console page.
 *
 * Staff are decided by the platform role, never by an organization's
 * grants - a creator team is not staff. The gate lives in one place so
 * every page says the same thing.
 *
 * This is a server component: it reads the session, so it must not be
 * imported by a client component. Pages that are client components check
 * the session on the client instead.
 */
export async function StaffOnly({
    children,
    notSignedInTitle = "You need to sign in",
    notSignedInDescription = "Sign in to use this tool.",
    deniedTitle = "Staff only",
    deniedDescription = "This area is for the people who run the site.",
}: {
    children: ReactNode;
    notSignedInTitle?: ReactNode;
    notSignedInDescription?: ReactNode;
    deniedTitle?: ReactNode;
    deniedDescription?: ReactNode;
}) {
    const session = await getOptionalSession();

    if (!session?.user) {
        return (
            <div className="rounded-lg border p-6">
                <p className="mb-3 text-sm font-medium">{notSignedInTitle}</p>
                <p className="mb-3 text-sm text-muted-foreground">
                    {notSignedInDescription}
                </p>
                <Link href="/" className="text-sm underline">
                    Go to home to sign in
                </Link>
            </div>
        );
    }

    if (!isStaffUser(session.user)) {
        return (
            <div className="rounded-lg border p-6">
                <p className="mb-1 text-sm font-medium">{deniedTitle}</p>
                <p className="text-sm text-muted-foreground">
                    {deniedDescription}
                </p>
            </div>
        );
    }

    return <>{children}</>;
}
