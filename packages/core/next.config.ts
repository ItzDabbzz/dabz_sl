import type { NextConfig } from "next";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import bundleAnalyzer from "@next/bundle-analyzer";

// Load env from the monorepo root
loadEnvConfig(path.resolve(__dirname, "..", ".."));

const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "true" });

const nextConfig: NextConfig = {
	typescript: {
		ignoreBuildErrors: true,
	},
	images: {
		remotePatterns: [
			{ protocol: "https", hostname: "marketplace.secondlife.com" },
			{ protocol: "https", hostname: "*.secondlife.com" },
			{ protocol: "https", hostname: "*.slm-assets.com" },
			{ protocol: "https", hostname: "*.cloudfront.net" },
			{ protocol: "https", hostname: "*.imgur.com" },
		],
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

export default withBundleAnalyzer(nextConfig);
