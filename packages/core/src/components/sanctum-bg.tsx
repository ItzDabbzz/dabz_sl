import type { CSSProperties } from "react";
import Image from "next/image";

const shootingStars = [
	{ top: "14%", left: "8%", angle: -12, delay: "12s", cycle: "23s" },
	{ top: "26%", left: "70%", angle: -18, delay: "4s", cycle: "29s" },
	{ top: "40%", left: "15%", angle: -10, delay: "18s", cycle: "31s" },
	{ top: "9%", left: "40%", angle: -20, delay: "9s", cycle: "27s" },
] as const;

export default function SanctumBg({
    mode = "cathedral",
    moon = "blood",
}: {
    mode?: "cathedral" | "none";
    moon?: "blood" | "none";
}) {
    return (
        <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[1] overflow-hidden"
        >
            {/* Stone gradient base (behind everything) */}
            <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_50%_-10%,rgba(120,0,0,0.08),transparent_60%),radial-gradient(1000px_500px_at_10%_10%,rgba(180,140,90,0.06),transparent_45%),linear-gradient(to_bottom,#08090c,#0b0d12_35%,#0a0b0f)]" />

            {/* Starfield texture above stone, blended for visibility */}
            <Image
                src="/8k_stars_milky_way.jpg"
                alt=""
                fill
                sizes="100vw"
                quality={55}
                className="object-cover opacity-80 mix-blend-screen [filter:brightness(1.15)_contrast(1.1)]"
            />

            {/* Vignette */}
            <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_40%,transparent_35%,rgba(0,0,0,0.5)_70%,rgba(0,0,0,0.85))] mix-blend-multiply" />

            {/* Soft beams (stained glass feel) */}
            {mode === "cathedral" ? (
                <>
                    <div className="absolute inset-0 opacity-15 [mask-image:radial-gradient(60%_60%_at_50%_40%,#000_10%,transparent_70%)]">
                        <div className="absolute -left-20 top-0 h-[140%] w-[40%] rotate-6 bg-gradient-to-b from-red-900/25 via-amber-200/10 to-transparent blur-3xl" />
                        <div className="absolute right-0 top-10 h-[140%] w-[35%] -rotate-3 bg-gradient-to-b from-rose-700/20 via-purple-400/10 to-transparent blur-3xl" />
                    </div>

                    {/* Slow moving fog */}
                    <div className="absolute inset-x-0 bottom-[-10%] h-[50%] bg-[radial-gradient(60%_80%_at_50%_100%,rgba(200,200,210,0.08),transparent_70%)] animate-pulse" />
                </>
            ) : null}

            {/* Blood moon using texture */}
            {moon === "blood" ? (
                <Image
                    src="/8k_moon.jpg"
                    alt=""
                    width={512}
                    height={512}
                    quality={70}
                    className="absolute right-[6%] top-[6%] h-40 w-40 lg:h-64 lg:w-64 rounded-full object-cover opacity-90 drop-shadow-[0_0_80px_rgba(193,30,55,0.45)] [filter:saturate(0.85)_brightness(0.9)_contrast(1.1)]"
                />
            ) : null}

            {/* Rare shooting stars */}
            <div className="absolute inset-0">
                {shootingStars.map((star, index) => (
                    <div
                        key={index}
                        className="absolute"
                        style={{
                            top: star.top,
                            left: star.left,
                            transform: `rotate(${star.angle}deg)`,
                        }}
                    >
                        <div
                            className="sanctum-shooting-star relative"
                            style={
                                {
                                    "--shooting-star-cycle": star.cycle,
                                    "--shooting-star-delay": star.delay,
                                } as CSSProperties
                            }
                        >
                            {/* Tail (fades behind) */}
                            <div className="h-px w-40 bg-gradient-to-r from-transparent via-white/40 to-white blur-[0.5px] shadow-[0_0_12px_rgba(255,255,255,0.25)]" />
                            {/* Bright head */}
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.85),0_0_22px_rgba(255,255,255,0.55)]" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Fine grain */}
            <div className="absolute inset-0 opacity-[0.06] mix-blend-overlay [background-image:radial-gradient(1px_1px_at_20%_30%,rgba(255,255,255,0.35)_0,transparent_1px),radial-gradient(1px_1px_at_70%_60%,rgba(255,255,255,0.3)_0,transparent_1px),radial-gradient(1px_1px_at_40%_80%,rgba(255,255,255,0.25)_0,transparent_1px)] [background-size:8px_8px,10px_10px,12px_12px]" />
        </div>
    );
}
