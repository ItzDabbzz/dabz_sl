import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Wrapper, WrapperWithQuery } from "@/components/wrapper";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
	title: {
		template: "%s | Sanctum Realms Project",
		default: "Sanctum Realms Project",
	},
	description: "A list of tools and projects for Second Life creators by Dabz.",
	metadataBase: new URL("https://sl.itzdabbzz.me"),
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
                {/* Preconnect to known image/CDN hosts */}
                <link rel="preconnect" href="https://marketplace.secondlife.com" />
                <link rel="preconnect" href="https://images.secondlife.com" />
                <link rel="preconnect" href="https://static.secondlife.com" />
                <link rel="preconnect" href="https://cdn.secondlife.com" />
                <link rel="preconnect" href="https://slm-assets.com" />
                <link rel="preconnect" href="https://cloudfront.net" />
                <link rel="preconnect" href="https://i.imgur.com" />
			</head>
			<body className={`${GeistSans.variable} ${GeistMono.variable} font-sans`}>
				<ThemeProvider attribute="class" defaultTheme="dark">
					<Wrapper>
						<WrapperWithQuery>{children}</WrapperWithQuery>
					</Wrapper>
					<Toaster richColors closeButton />
				</ThemeProvider>
			</body>
		</html>
	);
}
