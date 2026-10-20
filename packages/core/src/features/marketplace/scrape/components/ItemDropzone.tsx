"use client";

import { useCallback, useId, useRef, useState } from "react";
import { FileJson, FileText, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Props for {@link ItemDropzone}. */
export interface ItemDropzoneProps {
    /** Called with the chosen file. */
    onFile: (file: File) => void;
    /** Called when the loaded file should be discarded. */
    onClear: () => void;
    /** Name of the file currently loaded, if any. */
    fileName?: string;
    /** Short summary of what was loaded, e.g. "96 items · JSONL". */
    summary?: string;
    /** An error to show next to the zone. */
    error?: string | null;
    /** Disable the zone while a run is in flight. */
    disabled?: boolean;
}

const ACCEPT = "application/json,.json,.jsonl,.ndjson,text/plain";

/**
 * A drop target for item files.
 *
 * The old importer used a bare file input, which gave the user no hint about
 * what to drop and no way to drop at all. This is a labelled button that
 * doubles as a drop target, and it reports the file it is holding.
 */
export default function ItemDropzone({
    onFile,
    onClear,
    fileName,
    summary,
    error,
    disabled,
}: ItemDropzoneProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);
    const inputId = useId();

    const handleFiles = useCallback(
        (files: FileList | null) => {
            const file = files?.[0];
            if (file) onFile(file);
        },
        [onFile],
    );

    if (fileName) {
        return (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
                <FileJson className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium" title={fileName}>
                        {fileName}
                    </div>
                    {summary && (
                        <div className="text-xs text-muted-foreground">{summary}</div>
                    )}
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    onClick={() => {
                        if (inputRef.current) inputRef.current.value = "";
                        onClear();
                    }}
                    className="text-muted-foreground hover:text-foreground"
                >
                    <X className="mr-1 h-4 w-4" aria-hidden />
                    Clear
                </Button>
                <input
                    ref={inputRef}
                    id={inputId}
                    type="file"
                    accept={ACCEPT}
                    className="sr-only"
                    onChange={(e) => handleFiles(e.target.files)}
                />
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <label
                htmlFor={inputId}
                onDragOver={(e) => {
                    e.preventDefault();
                    if (!disabled) setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    if (disabled) return;
                    handleFiles(e.dataTransfer.files);
                }}
                className={cn(
                    "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border px-6 py-10 text-center transition-colors",
                    "hover:border-primary/60 hover:bg-accent/40 focus-within:border-primary/60",
                    dragging && "border-primary bg-accent/60",
                    disabled && "pointer-events-none opacity-50",
                )}
            >
                <span
                    className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-full bg-muted",
                        dragging && "bg-primary/15",
                    )}
                >
                    <Upload className="h-5 w-5 text-muted-foreground" aria-hidden />
                </span>
                <span className="text-sm font-medium">
                    Drop a <code className="font-mono text-xs">.json</code> or{" "}
                    <code className="font-mono text-xs">.jsonl</code> file here
                </span>
                <span className="text-xs text-muted-foreground">
                    or click to browse — a JSON array, a JSONL item file, or a
                    run checkpoint
                </span>
                <input
                    ref={inputRef}
                    id={inputId}
                    type="file"
                    accept={ACCEPT}
                    className="sr-only"
                    disabled={disabled}
                    onChange={(e) => handleFiles(e.target.files)}
                />
            </label>
            {error && (
                <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span>{error}</span>
                </p>
            )}
        </div>
    );
}
