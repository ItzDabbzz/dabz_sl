"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function Wrapper(props: { children: React.ReactNode }) {
	return <div className="min-w-0">{props.children}</div>;
}

const queryClient = new QueryClient();

export function WrapperWithQuery(props: { children: React.ReactNode | any }) {
	return <QueryClientProvider client={queryClient}>{props.children}</QueryClientProvider>;
}
