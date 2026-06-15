"use client"

import * as React from "react"
import { Monitor, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="relative">
        <span className="sr-only">Toggle theme</span>
        <div className="h-5 w-5" />
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative group hover:bg-primary/10">
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all duration-300 dark:-rotate-90 dark:scale-0 text-primary" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all duration-300 dark:rotate-0 dark:scale-100 text-primary" />
          <span className="sr-only">Toggle theme</span>
          <span className="absolute inset-0 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <span className="absolute top-1 right-1 w-1 h-1 bg-primary/60 rounded-full animate-sparkle" />
            <span className="absolute bottom-2 left-1.5 w-0.5 h-0.5 bg-accent/60 rounded-full animate-sparkle" style={{ animationDelay: "0.3s" }} />
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="glass-strong">
        <DropdownMenuItem onClick={() => setTheme("light")} className="flex items-center gap-2 cursor-pointer">
          <Sun className="h-4 w-4" />
          <span>Light</span>
          {theme === "light" ? <span className="ml-auto w-2 h-2 rounded-full bg-primary" /> : null}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")} className="flex items-center gap-2 cursor-pointer">
          <Moon className="h-4 w-4" />
          <span>Dark</span>
          {theme === "dark" ? <span className="ml-auto w-2 h-2 rounded-full bg-primary" /> : null}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")} className="flex items-center gap-2 cursor-pointer">
          <Monitor className="h-4 w-4" />
          <span>System</span>
          {theme === "system" ? <span className="ml-auto w-2 h-2 rounded-full bg-primary" /> : null}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
