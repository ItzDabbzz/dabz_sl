import * as React from "react";
import Link from "next/link";
import { Wrench, ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export type WorkInProgressProps = {
  title?: string;
  message?: string;
  href?: string;
  hrefText?: string;
  className?: string;
};

export function WorkInProgressNotice({
  title = "Work in progress",
  message = "This section is under active development and currently not in a working state.",
  href,
  hrefText = "Follow updates",
  className,
}: WorkInProgressProps) {
  return (
    <Alert
      className={cn(
        "relative overflow-hidden border-amber-300/40 bg-amber-50/60 text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100",
        "shadow-sm",
        className,
      )}
    >
      {/* Accent bar */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-amber-400 to-orange-500"
      />
      {/* Top hairline */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent"
      />

      <Wrench className="text-amber-600 dark:text-amber-400" />

      <AlertTitle className="flex items-center gap-2">
        {title}
        <Badge className="border-amber-200/50 bg-amber-100/80 text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/15 dark:text-amber-100">
          Preview
        </Badge>
      </AlertTitle>

      <AlertDescription>
        <p className="text-sm text-amber-900/80 dark:text-amber-100/80">{message}</p>
        {href ? (
          <Link
            href={href}
            prefetch={false}
            className="mt-2 inline-flex items-center gap-1 text-sm underline underline-offset-4 hover:text-amber-900 dark:hover:text-amber-50"
          >
            {hrefText}
            <ArrowRight className="size-4" />
          </Link>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

export default WorkInProgressNotice;
