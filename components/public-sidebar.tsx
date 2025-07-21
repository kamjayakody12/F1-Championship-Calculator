"use client"

import * as React from "react"
import {
  AudioWaveform,
  BookOpen,
  Bot,
  CarFront,
  CarIcon,
  ChartBar,
  ClapperboardIcon,
  ClipboardCheckIcon,
  Command,
  Crown,
  Frame,
  GalleryVerticalEnd,
  HomeIcon,
  Map,
  PieChart,
  Settings2,
  SquareTerminal,
  Trophy,
} from "lucide-react"

import { NavMain } from "@/components/public-nav-main"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"
import { IconGraph, IconInnerShadowTop, IconUser, IconUsersGroup } from "@tabler/icons-react"

// This is sample data.
const data = {
  teams: [
    {
      name: "F1 Championship Dashboard",
      logo: GalleryVerticalEnd,
    },
  ],
  navMain: [
    {
      title: "Home",
      url: "/public-dash",
      icon: HomeIcon,
    },
    {
      title: "Results",
      url: "/public-dash/results",
      icon: ClipboardCheckIcon,
    },
    {
      title: "Drivers Stats",
      url: "/public-dash/driver-stats",
      icon: IconGraph,
    },
    {
      title: "Driver Standings",
      url: "/public-dash/driver-standings",
      icon: Trophy,
    },
    {
      title: "Constructor Standings",
      url: "/public-dash/constructor-standings",
      icon: Crown,
    },
    {
      title: "Teams",
      url: "/public-dash/teams",
      icon: IconUsersGroup,
    },     
    {
      title: "Drivers",
      url: "/public-dash/driver",
      icon: IconUser,
    },  
  ],

}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="#">
                <CarFront className="!size-5" />
                <span className="text-base font-semibold">F1 Championship Dashboard</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
