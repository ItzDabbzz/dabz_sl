"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

export function Rating({ postId }: { postId: string }) {
    const [avg, setAvg] = useState<number>(0);
    const [count, setCount] = useState<number>(0);
    const [userScore, setUserScore] = useState<number | null>(null);
    const [isPending, startTransition] = useTransition();

    const fetchState = async () => {
        const res = await fetch(`/api/public/blog/${postId}/rating`, {
            cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
            average: number;
            count: number;
            userScore: number | null;
        };
        setAvg(data.average);
        setCount(data.count);
        setUserScore(data.userScore);
    };

    useEffect(() => {
        fetchState();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [postId]);

    const roundedAvg = useMemo(() => Math.round(avg), [avg]);

    const submit = async (score: number) => {
        const prev = { avg, count, userScore };
        // optimistic: if user had a score, adjust avg roughly; else increment count
        setUserScore(score);
        setCount((c) => (prev.userScore == null ? c + 1 : c));
        setAvg((a) => {
            if (prev.count === 0) return score;
            if (prev.userScore == null) {
                return (a * prev.count + score) / (prev.count + 1);
            }
            // replace prior rating
            const total = a * prev.count - prev.userScore + score;
            return total / prev.count;
        });

        startTransition(async () => {
            const res = await fetch(`/api/public/blog/${postId}/rating`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ score }),
            });
            if (!res.ok) {
                // revert on failure
                setAvg(prev.avg);
                setCount(prev.count);
                setUserScore(prev.userScore);
                return;
            }
            const data = (await res.json()) as {
                average: number;
                count: number;
                userScore: number;
            };
            setAvg(data.average);
            setCount(data.count);
            setUserScore(data.userScore);
        });
    };

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1">
                {Array.from({ length: 10 }).map((_, i) => {
                    const n = i + 1;
                    const active = (userScore ?? roundedAvg) >= n;
                    return (
                        <button
                            key={n}
                            type="button"
                            onClick={() => submit(n)}
                            title={`${n} / 10`}
                            className={cn(
                                "group inline-flex h-6 w-6 items-center justify-center transition-transform",
                                "hover:scale-110",
                                isPending
                                    ? "pointer-events-none opacity-75"
                                    : undefined,
                            )}
                            aria-pressed={userScore === n}
                            aria-label={`${n} out of 10`}
                        >
                            <Heart
                                className={cn(
                                    "h-5 w-5",
                                    active
                                        ? "fill-red-500 stroke-red-500"
                                        : "stroke-muted-foreground",
                                )}
                            />
                        </button>
                    );
                })}
            </div>
            <div className="text-xs text-muted-foreground">
                {count} rating{count === 1 ? "" : "s"} · Avg {avg.toFixed(1)} /
                10
            </div>
        </div>
    );
}
