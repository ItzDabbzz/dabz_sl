import Link from "next/link";
import { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared page furniture for the console.
 *
 * Every console page used to invent its own header - a title in one style,
 * a bordered wrapper in another, actions in a third. That is what made the
 * console feel cluttered: nothing lined up between pages. These primitives
 * give every page the same frame, so the only thing that changes is the
 * content.
 */

/** One step in a page's location. */
export type Crumb = { label: string; href?: string };

/** The header of a console page. */
export function PageHeader({
    title,
    description,
    actions,
    crumbs,
    className,
}: {
    title: ReactNode;
    description?: ReactNode;
    actions?: ReactNode;
    crumbs?: Crumb[];
    className?: string;
}) {
    return (
        <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", className)}>
            <div className="min-w-0 space-y-1">
                {crumbs && crumbs.length > 0 && (
                    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground">
                        {crumbs.map((crumb, index) => (
                            <span key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                                {index > 0 && <ChevronRight className="h-3 w-3" aria-hidden="true" />}
                                {crumb.href ? (
                                    <Link href={crumb.href} className="underline-offset-4 hover:underline">
                                        {crumb.label}
                                    </Link>
                                ) : (
                                    <span className="text-foreground/80">{crumb.label}</span>
                                )}
                            </span>
                        ))}
                    </nav>
                )}
                <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
                {description ? (
                    <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
                ) : null}
            </div>
            {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
    );
}

/**
 * A console page: a header and its content, with the spacing every page
 * should share.
 */
export function DashboardPage({
    title,
    description,
    actions,
    crumbs,
    children,
    className,
    contentClassName,
}: {
    title: ReactNode;
    description?: ReactNode;
    actions?: ReactNode;
    crumbs?: Crumb[];
    children: ReactNode;
    className?: string;
    contentClassName?: string;
}) {
    return (
        <div className={cn("space-y-6", className)}>
            <PageHeader
                title={title}
                description={description}
                actions={actions}
                crumbs={crumbs}
            />
            <div className={cn("space-y-6", contentClassName)}>{children}</div>
        </div>
    );
}

/**
 * A key number with its label.
 *
 * The label comes first and stays quiet; the number is the point. Keeping
 * them in this order makes a row of cards scannable as a column of values.
 */
export function StatCard({
    label,
    value,
    hint,
    icon,
    children,
    className,
}: {
    label: ReactNode;
    value: ReactNode;
    hint?: ReactNode;
    icon?: ReactNode;
    children?: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn("rounded-lg border bg-card p-4 text-card-foreground", className)}>
            <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {label}
                </span>
                {icon ? <span className="text-muted-foreground">{icon}</span> : null}
            </div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
            {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
            {children}
        </div>
    );
}

/**
 * A row of tools that belongs to a panel rather than to the page.
 */
export function PanelToolbar({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "flex flex-wrap items-center gap-2 border-b px-3 py-2",
                className,
            )}
        >
            {children}
        </div>
    );
}

/** Nothing to show, with the reason and a way out. */
export function EmptyState({
    icon,
    title,
    description,
    action,
    className,
}: {
    icon?: ReactNode;
    title: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-12 text-center", className)}>
            {icon ? <div className="text-muted-foreground">{icon}</div> : null}
            <div className="space-y-1">
                <div className="text-sm font-medium">{title}</div>
                {description ? (
                    <div className="max-w-sm text-xs text-muted-foreground">{description}</div>
                ) : null}
            </div>
            {action}
        </div>
    );
}
