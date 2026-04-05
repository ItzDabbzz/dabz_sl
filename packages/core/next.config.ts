import type { NextConfig } from "next";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import bundleAnalyzer from "@next/bundle-analyzer";

// Load env from the monorepo root
loadEnvConfig(path.resolve(__dirname, "..", ".."));

const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "true" });

const nextConfig: NextConfig = {
	poweredByHeader: false,
	images: {
		remotePatterns: [
			{ protocol: "https", hostname: "marketplace.secondlife.com" },
			{ protocol: "https", hostname: "*.secondlife.com" },
			{ protocol: "https", hostname: "*.slm-assets.com" },
			{ protocol: "https", hostname: "*.cloudfront.net" },
			{ protocol: "https", hostname: "*.imgur.com" },
		],
		qualities: [25, 50, 55, 70, 75],
	},
	// Externalize server-only packages that don't bundle well (e.g. large syntax
	// highlighters with native/wasm internals).
	serverExternalPackages: ["shiki"],
	typedRoutes: false,
	// Enable strict mode for React to help identify potential issues.
	reactStrictMode: true,
	// Tree-shake large icon/component packages for smaller client bundles.
	experimental: {
		optimizePackageImports: ["lucide-react", "@radix-ui/react-icons"],
		// cssChunking: true,
		// optimizeCss: true, -- disabled: Critters CSS inliner calls useContext internally
		// during /_global-error prerendering where no provider exists, causing a null crash.
		// optimizeServerReact: true,
		turbopackSourceMaps: false,
	}
};

export default withBundleAnalyzer(nextConfig);
