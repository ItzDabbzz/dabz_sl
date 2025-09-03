import type { NextConfig } from "next";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

// Load env from the monorepo root
loadEnvConfig(path.resolve(__dirname, "..", ".."));

const nextConfig: NextConfig = {
	typescript: {
		ignoreBuildErrors: true,
	},
	transpilePackages: ["@dabzsl/shared"],
	webpack: (config, { dev }) => {
		if (dev) {
			config.watchOptions = {
				...(config.watchOptions as any),
				ignored: [
					"**/node_modules/**",
				],
			} as any;
		}
		return config;
	},
};

export default nextConfig;
