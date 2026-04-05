"use client";

import { useEffect } from "react";

// Catches errors in the root layout (outside page boundaries)
export default function GlobalError({
    error,
    reset,
}: {
    error: Error;
    reset: () => void;
}) {
    useEffect(() => {
        // eslint-disable-next-line no-console
        console.error("Global error:", error);
    }, [error]);

    return (
        <html>
            <body>
                {/* Inline critical styles — this renders outside the root layout, so Tailwind is unavailable */}
                <style>{`
                    body { margin: 0; background: #0a0a0f; color: #e2e2e8; font-family: ui-sans-serif, system-ui, sans-serif; }
                    .ge-wrap { min-height: 100svh; display: flex; align-items: center; justify-content: center; padding: 4rem 1.5rem; }
                    .ge-inner { max-width: 36rem; text-align: center; }
                    .ge-icon { margin: 0 auto 1.5rem; height: 4rem; width: 4rem; border-radius: 9999px; background: rgba(239,68,68,.15); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; }
                    h1 { font-size: 1.5rem; font-weight: 600; letter-spacing: -.015em; margin: 0 0 .75rem; }
                    p { color: #8b8b9e; margin: 0 0 1.5rem; }
                    .ge-actions { display: flex; gap: .75rem; justify-content: center; flex-wrap: wrap; }
                    button, a { display: inline-flex; align-items: center; justify-content: center; border-radius: .375rem; padding: .5rem 1rem; font-size: .875rem; font-weight: 500; border: 1px solid #3a3a4e; background: transparent; color: inherit; cursor: pointer; text-decoration: none; }
                `}</style>
                <div className="ge-wrap">
                    <div className="ge-inner">
                        <div className="ge-icon">!</div>
                        <h1>Critical application error</h1>
                        <p>
                            An unrecoverable error occurred. Try reloading the
                            app or go back to the homepage.
                        </p>
                        <div className="ge-actions">
                            <button onClick={() => reset()}>Reload</button>
                            <a href="/">Home</a>
                        </div>
                    </div>
                </div>
            </body>
        </html>
    );
}
