import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Cinzel_Decorative } from "next/font/google";

const cinzelDecorative = Cinzel_Decorative({
	weight: ["400", "700", "900"],
	subsets: ["latin"],
	variable: "--font-cinzel-decorative",
	display: "swap",
});

export const metadata = {
	title: {
		template: "%s | Sanctum Realms Project",
		default: "Sanctum Realms Project",
	},
	description: "A list of tools and projects for Second Life creators by Dabz.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className={`${GeistSans.variable} ${GeistMono.variable} ${cinzelDecorative.variable} font-sans`}>
				<ThemeProvider attribute="class" defaultTheme="dark">
					<div className="min-w-0">{children}</div>
					<Toaster richColors closeButton />
				</ThemeProvider>
			</body>
		</html>
	);
}
