"use client";

import * as React from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator";

import { cn } from "@/lib/utils";

const Separator = ({
	ref,
	className,
	orientation = "horizontal",
	decorative = true,
	...props
}: React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root> & {
	// Optional: React 19 passes refs as ordinary props, and a decorative
	// separator never needs one. Making it required forced every call site
	// to write `ref={undefined as any}`.
	ref?: React.RefObject<React.ElementRef<typeof SeparatorPrimitive.Root>>;
}) => (
	<SeparatorPrimitive.Root
		ref={ref}
		decorative={decorative}
		orientation={orientation}
		className={cn(
			"shrink-0 bg-border",
			orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
			className,
		)}
		{...props}
	/>
);
Separator.displayName = SeparatorPrimitive.Root.displayName;

export { Separator };
