"use client";

import * as React from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/public-sidebar";
import { SiteHeader } from "@/components/site-header";
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
        <AppSidebar variant="sidebar" />

        {/* the rest of the page */}
        <SidebarInset>
          <SiteHeader />

          <main >{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </ThemeProvider>
  );
}
