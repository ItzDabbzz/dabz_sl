"use client";

import * as React from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type JsonEditorProps = {
    name: string;
    initialValue: unknown;
    minRows?: number;
    required?: boolean;
    // Built-in validation to avoid passing function props from Server ➜ Client
    requireObject?: boolean;
    invalidMessage?: string;
};

export function JsonEditor({
    name,
    initialValue,
    minRows = 12,
    required,
    requireObject = false,
    invalidMessage,
}: JsonEditorProps) {
    const [text, setText] = React.useState<string>("");
    const [error, setError] = React.useState<string | null>(null);
    const hiddenRef = React.useRef<HTMLInputElement>(null);

    // Initialize from initialValue
    React.useEffect(() => {
        try {
            const t = JSON.stringify(initialValue ?? {}, null, 2);
            setText(t);
            if (hiddenRef.current) {
                hiddenRef.current.value = t;
                hiddenRef.current.setCustomValidity("");
            }
            setError(null);
        } catch (e: any) {
            const msg = e?.message || "Failed to serialize JSON";
            setText("");
            if (hiddenRef.current) {
                hiddenRef.current.value = "";
                hiddenRef.current.setCustomValidity(msg);
            }
            setError(msg);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function parseAndValidate(value: string): string | null {
        try {
            const parsed = value.trim() ? JSON.parse(value) : null;
            if (
                requireObject &&
                (typeof parsed !== "object" || parsed === null)
            ) {
                return invalidMessage || "Value must be a JSON object";
            }
            return null;
        } catch (e: any) {
            return e?.message || "Invalid JSON";
        }
    }

    function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
        const value = e.target.value;
        setText(value);
        const err = parseAndValidate(value);
        setError(err);
        if (hiddenRef.current) {
            hiddenRef.current.value = value;
            hiddenRef.current.setCustomValidity(err || "");
        }
    }

    function handleFormat() {
        try {
            const parsed = text.trim() ? JSON.parse(text) : null;
            const pretty = JSON.stringify(parsed, null, 2);
            setText(pretty);
            if (hiddenRef.current) {
                hiddenRef.current.value = pretty;
                hiddenRef.current.setCustomValidity("");
            }
            setError(null);
        } catch (e: any) {
            const msg = e?.message || "Invalid JSON";
            setError(msg);
            if (hiddenRef.current) hiddenRef.current.setCustomValidity(msg);
        }
    }

    function handleMinify() {
        try {
            const parsed = text.trim() ? JSON.parse(text) : null;
            const min = JSON.stringify(parsed);
            setText(min);
            if (hiddenRef.current) {
                hiddenRef.current.value = min;
                hiddenRef.current.setCustomValidity("");
            }
            setError(null);
        } catch (e: any) {
            const msg = e?.message || "Invalid JSON";
            setError(msg);
            if (hiddenRef.current) hiddenRef.current.setCustomValidity(msg);
        }
    }

    return (
        <div className="grid gap-2">
            {/* Hidden input that is actually posted */}
            <input
                ref={hiddenRef}
                type="hidden"
                name={name}
                required={required}
            />

            <div className="flex items-center justify-between gap-2">
                <div
                    className={`text-xs ${
                        error ? "text-destructive" : "text-muted-foreground"
                    }`}
                >
                    {error ? `JSON error: ${error}` : "JSON looks valid"}
                </div>
                <div className="flex gap-2">
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleFormat}
                    >
                        Format
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleMinify}
                    >
                        Minify
                    </Button>
                </div>
            </div>

            <Textarea
                value={text}
                onChange={handleChange}
                rows={minRows}
                className={`font-mono text-xs ${error ? "border-destructive" : ""}`}
                aria-invalid={!!error}
                placeholder={'{\n  "key": "value"\n}'}
            />
        </div>
    );
}
