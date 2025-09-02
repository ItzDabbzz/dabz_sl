import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	typescript: {
		ignoreBuildErrors: true,
	},
	webpack: (config, { dev }) => {
		if (dev) {
			config.watchOptions = {
				...(config.watchOptions as any),
				ignored: [
					"**/node_modules/**",
					"C:/pagefile.sys",
					"C:/swapfile.sys",
					"C:/DumpStack.log.tmp",
				],
			} as any;
		}
		return config;
	},
};

export default nextConfig;
