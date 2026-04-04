"use client";

import { useEffect, useRef, useMemo } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

// Clean wire-grid + lightweight constellation lines
export function WebBg({ className, opacity = 1 }: { className?: string; opacity?: number }) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const gridCanvasRef = useRef<HTMLCanvasElement | null>(null); // cached grid prerender
    const prefersReduced = useReducedMotion();

    // Colors (tuned for dark/light themes). You can tweak alpha to taste.
    const strokeGrid = useMemo(() => "rgba(120,120,120,0.12)", []);
    const strokeLine = useMemo(() => "rgba(125,211,252,0.12)", []); // softer by default
    const strokeDot = useMemo(() => "rgba(255,255,255,0.45)", []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));

        let width = 0;
        let height = 0;

        // Points model
        type Pt = { x: number; y: number; vx: number; vy: number };
        let pts: Pt[] = [];

        // Cached grid canvas
        const ensureGridCanvas = () => {
            const off = document.createElement("canvas");
            off.width = Math.floor(width * dpr);
            off.height = Math.floor(height * dpr);
            const g = off.getContext("2d");
            if (!g) return;
            g.scale(dpr, dpr);

            // draw grid
            const gap = Math.max(
                40,
                Math.min(64, Math.floor(Math.min(width, height) / 14)),
            ); // responsive spacing
            g.clearRect(0, 0, width, height);
            g.strokeStyle = strokeGrid as any;
            g.lineWidth = 1;
            g.beginPath();
            for (let x = 0; x <= width; x += gap) {
                g.moveTo(x + 0.5, 0);
                g.lineTo(x + 0.5, height);
            }
            for (let y = 0; y <= height; y += gap) {
                g.moveTo(0, y + 0.5);
                g.lineTo(width, y + 0.5);
            }
            g.stroke();

            gridCanvasRef.current = off;
        };

        const seedPoints = () => {
            const area = width * height;
            // density tuned for perf; clamp for mobile/desktop
            const count = Math.max(
                20,
                Math.min(60, Math.floor(area * 0.00004)),
            );
            const maxV = 0.15; // slow drift
            const arr: Pt[] = [];
            for (let i = 0; i < count; i++) {
                arr.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    vx: (Math.random() * 2 - 1) * maxV,
                    vy: (Math.random() * 2 - 1) * maxV,
                });
            }
            pts = arr;
        };

        const resize = () => {
            const rect = canvas.parentElement?.getBoundingClientRect();
            width = Math.floor(rect?.width || window.innerWidth);
            height = Math.floor(rect?.height || window.innerHeight);
            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            (ctx as any).resetTransform?.();
            ctx.scale(dpr, dpr);
            ensureGridCanvas();
            seedPoints();
            drawStatic();
        };

        const drawStatic = () => {
            ctx.clearRect(0, 0, width, height);
            if (gridCanvasRef.current)
                ctx.drawImage(
                    gridCanvasRef.current,
                    0,
                    0,
                    gridCanvasRef.current.width / dpr,
                    gridCanvasRef.current.height / dpr,
                );
            // render dots only (no animation)
            const dotR = 1.1;
            ctx.fillStyle = strokeDot as any;
            for (const p of pts) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, dotR, 0, Math.PI * 2);
                ctx.fill();
            }
        };

        // Animated draw
        let raf = 0;
        let last = performance.now();
        const maxLinesPerFrame = 240; // slightly fewer lines for subtlety

        const tick = (t: number) => {
            raf = requestAnimationFrame(tick);
            // throttle to ~30fps for perf
            if (t - last < 33) return;
            last = t;

            // move points
            for (const p of pts) {
                p.x += p.vx;
                p.y += p.vy;
                // bounce
                if (p.x < 0 || p.x > width) p.vx *= -1;
                if (p.y < 0 || p.y > height) p.vy *= -1;
                // clamp just in case
                p.x = Math.max(0, Math.min(width, p.x));
                p.y = Math.max(0, Math.min(height, p.y));
            }

            // draw
            ctx.clearRect(0, 0, width, height);
            if (gridCanvasRef.current)
                ctx.drawImage(
                    gridCanvasRef.current,
                    0,
                    0,
                    gridCanvasRef.current.width / dpr,
                    gridCanvasRef.current.height / dpr,
                );

            // connections
            const threshold = Math.max(
                80,
                Math.min(140, Math.floor(Math.min(width, height) * 0.12)),
            );
            let lines = 0;
            ctx.lineWidth = 1;
            for (let i = 0; i < pts.length; i++) {
                for (let j = i + 1; j < pts.length; j++) {
                    if (lines >= maxLinesPerFrame) break;
                    const a = pts[i];
                    const b = pts[j];
                    const dx = a.x - b.x;
                    const dy = a.y - b.y;
                    const d2 = dx * dx + dy * dy;
                    if (d2 > threshold * threshold) continue;
                    const d = Math.sqrt(d2);
                    const alpha = Math.max(0, 1 - d / threshold) * 0.45; // softer
                    (ctx as any).strokeStyle = (strokeLine as string).replace(
                        /0\.12\)$/g,
                        `${(0.12 * alpha).toFixed(3)})`,
                    );
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.stroke();
                    lines++;
                }
            }

            // dots on top
            const dotR = 1.1;
            ctx.fillStyle = strokeDot as any;
            for (const p of pts) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, dotR, 0, Math.PI * 2);
                ctx.fill();
            }
        };

        resize();
        if (!prefersReduced) {
            raf = requestAnimationFrame(tick);
        }

        const onResize = () => resize();
        window.addEventListener("resize", onResize);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", onResize);
        };
    }, [prefersReduced, strokeDot, strokeGrid, strokeLine]);

    return (
        <div
            aria-hidden
            className={cn("pointer-events-none absolute inset-0", className)}
            style={{ opacity }}
        >
            <canvas ref={canvasRef} className="h-full w-full" />
        </div>
    );
}

export default WebBg;
