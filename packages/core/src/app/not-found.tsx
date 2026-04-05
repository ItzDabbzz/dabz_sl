import Link from "next/link";

export default function NotFound() {
    return (
        <div className="min-h-[70vh] w-full px-6 py-20 flex items-center justify-center bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-muted/30 via-background to-background">
            <div className="mx-auto max-w-2xl text-center space-y-6">
                <div className="mx-auto h-16 w-16 rounded-full bg-muted flex items-center justify-center text-2xl">?</div>
                <div className="space-y-2">
                    <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
                        Page not found
                    </h1>
                    <p className="text-muted-foreground">
                        The page you are looking for could not be found. It
                        might have been moved or deleted.
                    </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3">
                    <Link
                        href="/"
                        className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium border"
                    >
                        Go home
                    </Link>
                </div>
            </div>
        </div>
    );
}
