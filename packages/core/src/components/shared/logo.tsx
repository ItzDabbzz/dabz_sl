"use client";

import Image from "next/image";

export interface LogoProps {
	className?: string;
	width?: number;
	height?: number;
	alt?: string;
	priority?: boolean;
}

export const Logo = ({
	className,
	width = 60,
	height = 45,
	alt = "Sanctum Realms",
	priority = true,
}: LogoProps) => {
	return (
		<Image
			src="/logo.png"
			alt={alt}
			width={width}
			height={height}
			priority={priority}
			className={className}
		/>
	);
};
