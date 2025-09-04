"use client";

import type { ReactNode } from "react";

// Simple SWR provider that doesn't require the swr package
export function SWRProvider({ children }: { children: ReactNode }) {
	return <>{children}</>;
}


