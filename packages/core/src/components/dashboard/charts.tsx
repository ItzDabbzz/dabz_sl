"use client";

import React from "react";
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    ChartLegendContent,
} from "@/components/ui/chart";
import {
    AreaChart,
    Area,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
} from "recharts";

export function MiniArea({
    id,
    data,
    color = "hsl(var(--primary))",
}: {
    id: string;
    data: { date: string; value: number }[];
    color?: string;
}) {
    return (
        <ChartContainer
            id={id}
            className="h-full"
            ref={undefined as any}
            config={{ value: { label: "Series", color } }}
        >
            <AreaChart
                data={data}
                margin={{ left: 6, right: 6, top: 8, bottom: 0 }}
            >
                <defs>
                    <linearGradient
                        id={`${id}-fill`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                    >
                        <stop
                            offset="5%"
                            stopColor={color}
                            stopOpacity={0.35}
                        />
                        <stop offset="95%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <XAxis dataKey="date" tickLine={false} axisLine={false} hide />
                <YAxis tickLine={false} axisLine={false} hide />
                <ChartTooltip
                    content={(p: any) => (
                        <ChartTooltipContent {...p} hideLabel />
                    )}
                />
                <Area
                    type="monotone"
                    dataKey="value"
                    stroke={color}
                    fillOpacity={1}
                    fill={`url(#${id}-fill)`}
                    strokeWidth={2}
                />
            </AreaChart>
        </ChartContainer>
    );
}

export function ActivityLines({
    id,
    data,
}: {
    id: string;
    data: { date: string; deliveries: number; events: number }[];
}) {
    return (
        <ChartContainer
            id={id}
            className="h-full"
            ref={undefined as any}
            config={{
                deliveries: {
                    label: "Deliveries",
                    color: "hsl(var(--primary))",
                },
                events: {
                    label: "Audit Events",
                    color: "hsl(var(--muted-foreground))",
                },
            }}
        >
            <LineChart
                data={data}
                margin={{ left: 12, right: 12, top: 8, bottom: 0 }}
            >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                />
                <YAxis width={32} tickLine={false} axisLine={false} />
                <ChartTooltip
                    content={(p: any) => <ChartTooltipContent {...p} />}
                />
                <Legend
                    verticalAlign="top"
                    content={(p: any) => <ChartLegendContent {...p} />}
                />
                <Line
                    type="monotone"
                    dataKey="deliveries"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                />
                <Line
                    type="monotone"
                    dataKey="events"
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth={2}
                    dot={false}
                />
            </LineChart>
        </ChartContainer>
    );
}
