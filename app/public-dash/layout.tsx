"use client";

import * as React from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/public-sidebar";
import { SiteHeader } from "@/components/public-site-header";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // wrap everything in the ThemeProvider
    <ThemeProvider>
      {/* Provide the sidebar context (offcanvas on mobile, fixed on desktop) */}
      <SidebarProvider
        style={{
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties}
      >
        {/* your off-canvas/fixed sidebar */}
        <React.Suspense fallback={null}>
          <AppSidebar variant="sidebar" />
        </React.Suspense>

        {/* the rest of the page */}
        <SidebarInset className="public-dash-transparent flex flex-col min-h-screen">
          <SiteHeader />
          <Toaster position="top-center" />
          <KeyboardShortcuts />
          {/* <ShortcutHint /> */}
          <main className="flex-1 overflow-auto pt-2 sm:pt-4 px-2 sm:px-4 lg:px-6 w-full max-w-[1920px] mx-auto">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </ThemeProvider>
  );
}
