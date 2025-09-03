import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Wrapper, WrapperWithQuery } from "@/components/wrapper";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
	title: {
		template: "%s | SL Tools",
		default: "SL Tools",
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
