"use client"

import * as React from "react"
import {
  IconDashboard,
  IconChartBar,
  IconUsers,
  IconListDetails,
  IconFolder,
  IconSettings,
  IconHelp,
  IconSearch,
} from "@tabler/icons-react"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"

// ─── REPLACE THIS `data.navMain` WITH YOUR ADMIN ROUTES ───────────────────────
const data = {
  user: {
    name: "Admin",
    email: "you@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "Results",
      url: "/admin",
      icon: IconChartBar,
    },
    {
      title: "Drivers",
      url: "/admin/drivers",
      icon: IconUsers,
    },
    {
      title: "Teams",
      url: "/admin/teams",
      icon: IconListDetails,
    },
    {
      title: "Tracks",
      url: "/admin/manage-tracks",
      icon: IconFolder,
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "/admin/settings",
      icon: IconSettings,
    },
    {
      title: "Help",
      url: "/admin/help",
      icon: IconHelp,
    },
  ],
}

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        {/* Remove bullets and reset spacing */}
        <SidebarMenu className="list-none p-0 m-0">
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a href="/admin/dashboard" className="flex items-center gap-2 p-2">
                <IconDashboard className="size-5" />
                <span className="text-lg font-semibold">F1 Admin Dashboard</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Main navigation without bullets */}
        <SidebarMenu className="list-none p-0 m-0">
          {data.navMain.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild>
                <a href={item.url} className="flex items-center gap-2 p-2">
                  <item.icon className="size-4" />
                  <span>{item.title}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter>
        {/* Secondary navigation without bullets */}
        <SidebarMenu className="list-none p-0 m-0">
          {data.navSecondary.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild>
                <a href={item.url} className="flex items-center gap-2 p-2">
                  <item.icon className="size-4" />
                  <span>{item.title}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>

        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
