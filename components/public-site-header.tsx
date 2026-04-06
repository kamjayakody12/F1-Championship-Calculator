"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { PublicSeasonSelector } from "@/components/public-season-selector"

// map each admin route to its header title
const titleMap: Record<string, string> = {
  "/public-dash": "Home",
  "/public-dash/results": "Results",
  "/public-dash/driver-stats": "Drivers Stats",
  "/public-dash/driver-standings": "Driver Standings",
  "/public-dash/constructor-standings": "Constructor Standings",
  "/public-dash/teams": "Teams",
  "/public-dash/driver": "Drivers",
}

export function SiteHeader() {
  const pathname = usePathname() || ""
  const title = titleMap[pathname] || ""
  const isHomePage = pathname === "/public-dash"

  return (
    <header
      className="sticky top-0 z-50 flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)"
      style={isHomePage ? { marginBottom: "calc(var(--header-height) * -1)" } : undefined}
    >
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{title}</h1>
        <div className="ml-auto flex items-center gap-4">
          <React.Suspense fallback={null}>
            <PublicSeasonSelector variant="header" />
          </React.Suspense>
        </div>
      </div>
    </header>
  )
}