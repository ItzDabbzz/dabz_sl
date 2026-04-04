import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { createHash, randomBytes } from "crypto";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// Canonical JSON stringify: stable key order for hashes/ETags
export function stableStringify(value: unknown): string {
	const seen = new WeakSet();
	const sorter = (val: any): any => {
		if (val === null || typeof val !== "object") return val;
		if (seen.has(val)) return null; // break cycles
		seen.add(val);
		if (Array.isArray(val)) return val.map(sorter);
		const keys = Object.keys(val).sort();
		const obj: Record<string, any> = {};
		for (const k of keys) obj[k] = sorter((val as any)[k]);
		return obj;
	};
	return JSON.stringify(sorter(value));
}

export function sha256Hex(input: string): string {
	return createHash("sha256").update(input).digest("hex");
}

export function makeConfigHash(config: unknown): string {
	return sha256Hex(stableStringify(config));
}

export function makeEtagFromHash(hash: string): string {
	// Return full hash as ETag token (without quotes)
	return hash;
}

export function generateToken(bytes = 32): string {
	const buf = randomBytes(bytes);
	// base64url
	return buf
		.toString("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

export function hashToken(token: string): string {
	return sha256Hex(token);
}
