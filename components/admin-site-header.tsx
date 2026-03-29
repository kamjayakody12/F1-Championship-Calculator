"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

// map each admin route to its header title
const titleMap: Record<string, string> = {
  "/admin": "Race Results",
  "/admin/drivers": "Drivers",
  "/admin/teams": "Teams",
  "/admin/manage-tracks": "Tracks",
  "/admin/schedule": "Schedules",
}

export function SiteHeader() {
  const pathname = usePathname() || ""
  const title = titleMap[pathname] || ""

  return (
    <header className="sticky top-0 z-50 flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{title}</h1>
        <div className="ml-auto" />
      </div>
    </header>
  )
}