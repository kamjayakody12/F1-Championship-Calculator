"use client";

import { SWRConfig } from "swr";
import type { ReactNode } from "react";

async function defaultJsonFetcher(input: string | URL | Request, init?: RequestInit) {
	const response = await fetch(input, init);
	if (!response.ok) {
		let message = `Request failed with ${response.status}`;
		try {
			const body = await response.json();
			if (body?.error) message = body.error;
		} catch (_) {
			// ignore
		}
		throw new Error(message);
	}
	// If no content
	if (response.status === 204) return null;
	return response.json();
}

export function SWRProvider({ children }: { children: ReactNode }) {
	return (
		<SWRConfig
			value={{
				fetcher: defaultJsonFetcher,
				dedupingInterval: 2000,
				errorRetryInterval: 3000,
				revalidateOnFocus: true,
				revalidateIfStale: true,
				revalidateOnReconnect: true,
			}}
		>
			{children}
		</SWRConfig>
	);
}


