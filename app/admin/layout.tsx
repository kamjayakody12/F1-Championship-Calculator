// app/admin/layout.tsx
"use client";

import * as React from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/admin-sidebar";
import { SiteHeader } from "@/components/admin-site-header";
// ← import your ThemeProvider
import { ThemeProvider } from "@/components/theme-provider";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // wrap everything in the ThemeProvider
    <ThemeProvider attribute="class" defaultTheme="system">
      {/* Provide the sidebar context (offcanvas on mobile, fixed on desktop) */}
      <SidebarProvider
        style={{
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties}
      >
        {/* your off-canvas/fixed sidebar */}
        <AppSidebar variant="inset" />

        {/* the rest of the page */}
        <SidebarInset className="flex flex-col min-h-screen">
          <SiteHeader />

          <main className="flex-1 p-6 overflow-auto">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </ThemeProvider>
  );
}
