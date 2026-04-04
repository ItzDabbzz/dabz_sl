"use client";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
	CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { signIn } from "@/features/auth/client";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { getCallbackURL } from "@/features/auth/shared";

export default function SignIn() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, startTransition] = useTransition();
	const [rememberMe, setRememberMe] = useState(false);
	const router = useRouter();
	const params = useSearchParams();

	return (
		<Card className="w-full sm:max-w-md rounded-md">
			<CardHeader className="space-y-2">
				<CardTitle className="text-lg md:text-xl">Sign In</CardTitle>
				<CardDescription className="text-xs md:text-sm">
					Enter your email below to login to your account
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="grid gap-4">
					<div className="grid gap-2">
						<Label htmlFor="email">Email</Label>
						<Input
							id="email"
							type="email"
							placeholder="m@example.com"
							required
							autoComplete="email"
							onChange={(e) => {
								setEmail(e.target.value);
							}}
							value={email}
						/>
					</div>

					<div className="grid gap-2">
						<div className="flex items-center">
							<Label htmlFor="password">Password</Label>
							<Link
								href="/forget-password"
								className="ml-auto inline-block text-sm underline"
							>
								Forgot your password?
							</Link>
						</div>

						<Input
							id="password"
							type="password"
							placeholder="password"
							autoComplete="current-password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
						/>
					</div>

					<div className="flex items-center gap-2">
						<Checkbox
							id="remember"
							onClick={() => {
								setRememberMe(!rememberMe);
							}}
						/>
						<Label htmlFor="remember">Remember me</Label>
					</div>

					<Button
						type="submit"
						className="w-full"
						disabled={loading}
						onClick={async () => {
							startTransition(async () => {
								await signIn.email(
									{ email, password, rememberMe },
									{
										onSuccess() {
											toast.success("Successfully signed in");
											router.push(getCallbackURL(params));
										},
									},
								);
							});
						}}
					>
						{loading ? <Loader2 size={16} className="animate-spin" /> : "Login"}
					</Button>

					<div
						className={cn(
							"w-full gap-2 flex items-center",
							"justify-between flex-col",
						)}
					>
						<Button
							variant="outline"
							className={cn("w-full gap-2")}
							onClick={async () => {
								try {
									await signIn.social({
										provider: "google",
										callbackURL: getCallbackURL(params),
									});
								} catch {
									toast.error("Google sign-in failed");
								}
							}}
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="0.98em"
								height="1em"
								viewBox="0 0 256 262"
							>
								<path
									fill="#4285F4"
									d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622l38.755 30.023l2.685.268c24.659-22.774 38.875-56.282 38.875-96.027"
								></path>
								<path
									fill="#34A853"
									d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055c-34.523 0-63.824-22.773-74.269-54.25l-1.531.13l-40.298 31.187l-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1"
								></path>
								<path
									fill="#FBBC05"
									d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82c0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602z"
								></path>
								<path
									fill="#EB4335"
									d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0C79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251"
								></path>
							</svg>
							Sign in with Google
						</Button>
						<Button
							variant="outline"
							className={cn("w-full gap-2")}
							onClick={async () => {
								try {
									await signIn.social({
										provider: "github",
										callbackURL: getCallbackURL(params),
									});
								} catch {
									toast.error("GitHub sign-in failed");
								}
							}}
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="1em"
								height="1em"
								viewBox="0 0 24 24"
							>
								<path
									fill="currentColor"
									d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5c.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34c-.46-1.16-1.11-1.47-1.11-1.47c-.91-.62.07-.6.07-.6c1 .07 1.53 1.03 1.53 1.03c.87 1.52 2.34 1.07 2.91.83c.09-.65.35-1.09.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92c0-1.11.38-2 1.03-2.71c-.1-.25-.45-1.29.1-2.64c0 0 .84-.27 2.75 1.02c.79-.22 1.65-.33 2.5-.33s1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02c.55 1.35.2 2.39.1 2.64c.65.71 1.03 1.6 1.03 2.71c0 3.82-2.34 4.66-4.57 4.91c.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2"
								/>
							</svg>
							Sign in with GitHub
						</Button>
						<Button
							variant="outline"
							className={cn("w-full gap-2")}
							onClick={async () => {
								try {
									await signIn.social({
										provider: "discord",
										callbackURL: getCallbackURL(params),
									});
								} catch {
									toast.error("Discord sign-in failed");
								}
							}}
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="1em"
								height="1em"
								viewBox="0 0 24 24"
							>
								<path
									fill="currentColor"
									d="M20.317 4.369A19.791 19.791 0 0 0 16.558 3c-.014.024-1.03 1.904-1.474 3.012a13.1 13.1 0 0 0-3.168 0C11.474 4.904 10.47 3.024 10.457 3A19.736 19.736 0 0 0 6.696 4.369C3.73 9.102 2.89 13.71 3.2 18.271a19.9 19.9 0 0 0 6.013 3.084c.258-.351.488-.724.686-1.116c-.378-.144-.739-.314-1.08-.51a.17.17 0 0 1-.008-.292c.073-.054.146-.111.215-.168c.05-.036.115-.041.169-.015c2.273 1.034 4.736 1.034 7.003 0c.054-.026.119-.021.169.015c.069.057.142.114.215.168a.17.17 0 0 1-.008.292c-.341.197-.702.367-1.08.511c.198.391.428.764.686 1.115a19.9 19.9 0 0 0 6.013-3.084c.49-6.763-1.046-11.323-2.946-13.902M9.681 15.345c-1.015 0-1.846-.93-1.846-2.074s.82-2.074 1.846-2.074c1.034 0 1.856.934 1.846 2.074c0 1.145-.812 2.074-1.846 2.074m4.638 0c-1.015 0-1.846-.93-1.846-2.074s.82-2.074 1.846-2.074c1.034 0 1.856.934 1.846 2.074c0 1.145-.812 2.074-1.846 2.074"
								/>
							</svg>
							Sign in with Discord
						</Button>
					</div>
				</div>
			</CardContent>
			<CardFooter>
				<div className="flex justify-center w-full border-t pt-4">
					<p className="text-center text-xs text-neutral-500">
						built with{" "}
						<Link
							href="https://better-auth.com"
							className="underline"
							target="_blank"
						>
							<span className="dark:text-white/70 cursor-pointer">
								better-auth.
							</span>
						</Link>
					</p>
				</div>
			</CardFooter>
		</Card>
	);
}
