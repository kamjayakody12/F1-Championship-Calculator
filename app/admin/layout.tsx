// app/admin/layout.tsx
"use client";

import * as React from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Provide the sidebar context (offcanvas on mobile, fixed on desktop)
    <SidebarProvider
    style={{
        "--sidebar-width": "calc(var(--spacing) * 72)",
        "--header-height": "calc(var(--spacing) * 12)",
      } as React.CSSProperties}>
      {/* 
        Our AppSidebar is built on shadcn’s <Sidebar collapsible="offcanvas"> 
        so it will hide into an off-canvas drawer on phones/tablets,
        and be fixed on larger screens. 
      */}
      <AppSidebar variant='inset' />

      {/* 
        SidebarInset is where the main page goes.
        We add SiteHeader here so it sits above every admin page.
      */}
      <SidebarInset className="flex flex-col min-h-screen">
        {/* 
          SiteHeader should include the sidebar toggle button (hamburger)
          on mobile via shadcn’s pattern. 
        */}
        <SiteHeader />

        {/* 
          Your pages render here.
          px/y ensures consistent padding. 
        */}
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
