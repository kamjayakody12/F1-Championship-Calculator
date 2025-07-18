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
    {
      name: "Admin Dashboard",
      logo: AudioWaveform,
      url: "/login",
    },
  ],
  navMain: [
    {
      title: "Home",
      url: "#",
      icon: HomeIcon,
    },
    {
      title: "Results",
      url: "#",
      icon: ClipboardCheckIcon,
    },
    {
      title: "Drivers Stats",
      url: "#",
      icon: IconGraph,
    },
    {
      title: "Driver Standings",
      url: "#",
      icon: Trophy,
    },
    {
      title: "Constructor Standings",
      url: "#",
      icon: Crown,
    },
    {
      title: "Teams",
      url: "#",
      icon: IconUsersGroup,
    },     
    {
      title: "Drivers",
      url: "#",
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
