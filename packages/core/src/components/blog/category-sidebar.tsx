"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type BlogCategory = { id: string; name: string; slug: string };

export function CategorySidebar({
    categories,
}: {
    categories: BlogCategory[];
}) {
    const sp = useSearchParams();
    const selected = new Set((sp.get("c") || "").split(",").filter(Boolean));

    const pill = (
        active: boolean,
        label: string,
        href: string,
        key?: string
    ) => (
        <Link key={key ?? href} href={href} className="inline-block">
            <Badge
                variant={active ? "secondary" : "outline"}
                className={`rounded-full px-3 py-1 ${
                    active ? "" : "hover:bg-muted/70"
                }`}
            >
                {label}
            </Badge>
        </Link>
    );

    return (
        <aside className="w-full max-w-full">
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">Categories</CardTitle>
                        <Button
                            asChild
                            variant="link"
                            className="h-auto p-0 text-xs"
                        >
                            <Link href="/">← Back Home</Link>
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2">
                        {pill(selected.size === 0, "All posts", "/blog")}
                        {categories.map((c) => {
                            const active = selected.has(c.slug);
                            const href = `/blog?c=${encodeURIComponent(c.slug)}`;
                            return pill(active, c.name, href, c.id);
                        })}
                    </div>
                </CardContent>
            </Card>
        </aside>
    );
}
