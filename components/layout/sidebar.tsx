"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Building2,
  Code2,
  Package,
  Palette,
  ChevronDown,
  ChevronRight,
  FolderKanban,
  Calendar,
  FileText,
  Terminal,
  GitBranch,
  Bot,
  MessageSquare,
  Settings,
  HelpCircle,
  UsersRound,
  Lightbulb,
  Map,
  Menu,
} from "lucide-react"

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  children?: NavItem[]
}

const developmentNav: NavItem[] = [
  { label: "Overview", href: "/development", icon: LayoutDashboard },
  { label: "Projects", href: "/development/projects", icon: FolderKanban },
  { label: "Sprints", href: "/development/sprints", icon: Calendar },
  { label: "Documents", href: "/development/documents", icon: FileText },
  { label: "Git", href: "/development/git", icon: GitBranch },
  { label: "AI Assistant", href: "/development/ai-assistant", icon: Bot },
  { label: "Project Chats", href: "/development/chats", icon: MessageSquare },
]

interface DepartmentSection {
  name: string
  icon: React.ElementType
  basePath: string
  items: NavItem[]
}

const departments: DepartmentSection[] = [
  { name: "Workspace", icon: Code2, basePath: "/development", items: developmentNav },
]

export function Sidebar() {
  const pathname = usePathname()
  const [expandedSections, setExpandedSections] = useState<string[]>(["Workspace"])

  const toggleSection = (name: string) => {
    setExpandedSections(prev =>
      prev.includes(name)
        ? prev.filter(s => s !== name)
        : [...prev, name]
    )
  }

  const isActive = (href: string) => pathname === href
  const isSectionActive = (basePath: string) => pathname.startsWith(basePath)

  const navContent = (
    <>
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <span className="text-sm font-bold text-primary-foreground">A</span>
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-sidebar-foreground">Anka</span>
          <span className="text-xs text-sidebar-foreground/60">Diversify OS</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          {departments.map((dept) => (
            <div key={dept.name} className="mb-2">
              <button
                onClick={() => toggleSection(dept.name)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isSectionActive(dept.basePath)
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <div className="flex items-center gap-3">
                  <dept.icon className="h-4 w-4" />
                  <span>{dept.name}</span>
                </div>
                {expandedSections.includes(dept.name) ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>

              {expandedSections.includes(dept.name) && (
                <div className="ml-4 mt-1 space-y-1 border-l border-sidebar-border pl-3">
                  {dept.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                        isActive(item.href)
                          ? "bg-primary text-primary-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </nav>

      {/* Bottom Links */}
      <div className="border-t border-sidebar-border p-3">
        <div className="space-y-1">
          <Link
            href="/settings"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </Link>
          <Link
            href="/help"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <HelpCircle className="h-4 w-4" />
            <span>Help & Support</span>
          </Link>
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        {navContent}
      </aside>

      {/* Mobile hamburger */}
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="fixed left-4 top-3.5 z-50 flex h-9 w-9 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0 bg-sidebar border-sidebar-border">
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          {navContent}
        </SheetContent>
      </Sheet>
    </>
  )
}
