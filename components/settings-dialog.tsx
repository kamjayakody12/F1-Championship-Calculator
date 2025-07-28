"use client"

import * as React from "react"
import {
  Bell,
  Check,
  Globe,
  Home,
  Keyboard,
  Link,
  Lock,
  Menu,
  MessageCircle,
  Paintbrush,
  Settings,
  Video,
} from "lucide-react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Toggle } from "@/components/ui/toggle";

const data = {
  nav: [
    { name: "Home", icon: Home },
    { name: "Appearance", icon: Paintbrush },
    { name: "Rules", icon: Globe },
    { name: "Accessibility", icon: Keyboard },
    { name: "Audio & video", icon: Video },
    { name: "Privacy & visibility", icon: Lock },
    { name: "Advanced", icon: Settings },
  ],
}

export function SettingsDialog() {
  const [open, setOpen] = React.useState(true);
  const [poleGivesPoint, setPoleGivesPoint] = React.useState(false);
  const [fastestLapGivesPoint, setFastestLapGivesPoint] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setLoading(true);
    fetch("/api/rules")
      .then((res) => res.json())
      .then((data) => {
        setPoleGivesPoint(!!data.polegivespoint);
        setFastestLapGivesPoint(!!data.fastestlapgivespoint);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ polegivespoint: poleGivesPoint, fastestlapgivespoint: fastestLapGivesPoint }),
    });
    if (!res.ok) {
      setError("Failed to save settings");
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Open Dialog</Button>
      </DialogTrigger>
      <DialogContent className="overflow-hidden p-0 md:max-h-[500px] md:max-w-[700px] lg:max-w-[800px]">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Customize your settings here.
        </DialogDescription>
        <SidebarProvider className="items-start">
          <Sidebar collapsible="none" className="hidden md:flex">
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {data.nav.map((item) => (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton
                          asChild
                          isActive={item.name === "Rules"}
                        >
                          <a href="#">
                            <item.icon />
                            <span>{item.name}</span>
                          </a>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
          <main className="flex h-[480px] flex-1 flex-col overflow-hidden">
            <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
              <div className="flex items-center gap-2 px-4">
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem className="hidden md:block">
                      <BreadcrumbLink href="#">Settings</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                      <BreadcrumbPage>Rules</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            </header>
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 pt-0">
              <div className="max-w-xl bg-muted/50 rounded-xl p-6 flex flex-col gap-4">
                <h2 className="font-semibold text-lg">League Rules</h2>
                {loading ? (
                  <span>Loading...</span>
                ) : (
                  <>
                    <label className="flex items-center gap-2">
                      <Toggle
                        pressed={poleGivesPoint}
                        onPressedChange={setPoleGivesPoint}
                        aria-label="Award extra point for pole position"
                        id="poleGivesPoint"
                      />
                      Award extra point for pole position
                    </label>
                    <label className="flex items-center gap-2">
                      <Toggle
                        pressed={fastestLapGivesPoint}
                        onPressedChange={setFastestLapGivesPoint}
                        aria-label="Award extra point for fastest lap"
                        id="fastestLapGivesPoint"
                      />
                      Award extra point for fastest lap
                    </label>
                    <Button onClick={handleSave} disabled={saving} className="mt-4">
                      {saving ? "Saving..." : "Save"}
                    </Button>
                    {error && <span className="text-red-500">{error}</span>}
                  </>
                )}
              </div>
            </div>
          </main>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  );
}
