import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
	title: {
		template: "%s | Sanctum Realms Project",
		default: "Sanctum Realms Project",
	},
	description: "A list of tools and projects for Second Life creators by Dabz.",
	metadataBase: new URL("https://www.sanctumrp.net"),
	icons: {
		icon: [
			{ url: "/favicon/favicon.ico", sizes: "any" },
			{ url: "/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
			{ url: "/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
		],
		apple: [{ url: "/favicon/apple-touch-icon.png" }],
	},
	manifest: "/favicon/site.webmanifest",
	openGraph: {
		title: "Sanctum Realms Project",
		description: "A list of tools and projects for Second Life creators by Dabz.",
		url: "https://www.sanctumrp.net",
		images: [{ url: "/og.png", width: 1200, height: 930 }],
	},
	twitter: {
		card: "summary_large_image",
		title: "Sanctum Realms Project",
		description: "A list of tools and projects for Second Life creators by Dabz.",
		images: ["/og.png"],
	},
});

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<link rel="icon" href="/favicon/favicon.ico" sizes="any" />
				<link rel="preconnect" href="https://marketplace.secondlife.com" />
				<link rel="preconnect" href="https://images.secondlife.com" />
				<link rel="preconnect" href="https://i.imgur.com" />
			</head>
			<body className={`${GeistSans.variable} ${GeistMono.variable} font-sans`}>
				<ThemeProvider attribute="class" defaultTheme="dark">
					<div className="min-w-0">{children}</div>
					<Toaster richColors closeButton />
				</ThemeProvider>
			</body>
		</html>
	);
}
