"use client";

import SignIn from "@/components/sign-in";
import { SignUp } from "@/components/sign-up";
// Replace custom Tabs2 with shadcn Tabs (Radix)
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { client } from "@/lib/auth-client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { getCallbackURL } from "@/lib/shared";
import Image from "next/image";

export default function Page() {
	const router = useRouter();
	const params = useSearchParams();
	useEffect(() => {
		client.oneTap({
			fetchOptions: {
				onError: ({ error }) => {
					toast.error(error.message || "An error occurred");
				},
				onSuccess: () => {
					toast.success("Successfully signed in");
					router.push(getCallbackURL(params));
				},
			},
		});
	}, [router, params]);

	return (
		<div className="w-full">
			<div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 py-8">
				<Image
					src="/logo.png"
					alt="Logo"
					width={1024}
					height={1024}
					className="mb-5 h-60 w-auto"
					priority
				/>
				<Tabs defaultValue="sign-in" className="w-full">
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="sign-in">Sign In</TabsTrigger>
						<TabsTrigger value="sign-up">Sign Up</TabsTrigger>
					</TabsList>
					<TabsContent value="sign-in">
						<SignIn />
					</TabsContent>
					<TabsContent value="sign-up">
						<SignUp />
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
