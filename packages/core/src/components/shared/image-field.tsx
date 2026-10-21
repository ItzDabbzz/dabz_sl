"use client";

import { useRef, useState } from "react";
import { ImageIcon, Link2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * A picture for a profile.
 *
 * A creator picks a file rather than pasting a link: the picture is part
 * of who they are, and a link box is not a picture picker. The file is
 * read as it is - bytes and all - so an animated GIF stays animated, which
 * re-encoding it would throw away.
 *
 * A link can still be used, for a picture that already lives somewhere
 * else.
 */

/** The biggest file we will hold as a picture. */
const MAX_BYTES = 4 * 1024 * 1024;

function readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("read failed"));
        reader.readAsDataURL(file);
    });
}

export function ImageField({
    value,
    onChange,
    label,
    hint,
    shape = "wide",
    className,
}: {
    value: string | null;
    onChange: (next: string | null) => void;
    label: string;
    hint?: string;
    /** "wide" for a banner, "square" for a portrait. */
    shape?: "wide" | "square";
    className?: string;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [dragging, setDragging] = useState(false);

    async function take(file: File) {
        setError(null);
        if (!file.type.startsWith("image/")) {
            setError("That file is not a picture.");
            return;
        }
        if (file.size > MAX_BYTES) {
            setError(
                "That picture is larger than 4 MB. A smaller one works better.",
            );
            return;
        }
        setBusy(true);
        try {
            // The file is kept as it is, so a GIF still moves.
            onChange(await readAsDataUrl(file));
        } catch {
            setError("That picture could not be read.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className={cn("space-y-2", className)}>
            <Label>{label}</Label>

            <div
                onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    const file = event.dataTransfer.files?.[0];
                    if (file) void take(file);
                }}
                className={cn(
                    "relative overflow-hidden rounded-lg border border-dashed transition-colors",
                    dragging
                        ? "border-primary bg-primary/5"
                        : "border-border",
                )}
            >
                {value ? (
                    <div
                        className={cn(
                            "w-full",
                            shape === "wide"
                                ? "aspect-[3/1]"
                                : "aspect-square max-w-[9rem]",
                        )}
                    >
                        {/* A plain image, so an animated GIF keeps moving -
                            the image optimizer would serve one frame. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={value}
                            alt=""
                            className={cn(
                                "h-full w-full",
                                shape === "square"
                                    ? "object-cover"
                                    : "object-cover",
                            )}
                        />
                    </div>
                ) : (
                    <div
                        className={cn(
                            "flex flex-col items-center justify-center gap-1 text-muted-foreground",
                            shape === "wide"
                                ? "aspect-[3/1]"
                                : "aspect-square max-w-[9rem]",
                        )}
                    >
                        <ImageIcon className="h-5 w-5" />
                        <span className="text-xs">No picture yet</span>
                    </div>
                )}
            </div>

            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void take(file);
                    event.target.value = "";
                }}
            />

            <div className="flex flex-wrap items-center gap-2">
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() => inputRef.current?.click()}
                >
                    <Upload className="h-3.5 w-3.5" />
                    {value ? "Replace" : "Upload a picture"}
                </Button>
                {value ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onChange(null)}
                    >
                        <X className="h-3.5 w-3.5" />
                        Remove
                    </Button>
                ) : null}
            </div>

            <div className="flex items-center gap-2">
                <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <Input
                    value={value && value.startsWith("http") ? value : ""}
                    onChange={(event) => onChange(event.target.value || null)}
                    placeholder="…or paste a link to a picture"
                    aria-label={`${label} link`}
                />
            </div>

            {error ? (
                <p className="text-xs text-destructive">{error}</p>
            ) : hint ? (
                <p className="text-xs text-muted-foreground">{hint}</p>
            ) : null}
        </div>
    );
}
