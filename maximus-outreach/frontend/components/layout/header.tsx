"use client";

import { useAuth } from "@/contexts/auth-context";
import { ThemeToggle } from "./theme-toggle";
import { ClientSelector } from "./client-selector";
import { Breadcrumbs } from "./breadcrumbs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Menu } from "lucide-react";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user, logout, isOwner } = useAuth();

  return (
    <header className="flex h-[60px] items-center justify-between border-b border-border bg-background/95 backdrop-blur-sm px-4 lg:px-5 shrink-0 sticky top-0 z-20">
      {/* Left: hamburger (mobile) + breadcrumbs */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onMenuClick}
          aria-label="Open navigation menu"
          className={cn(
            "lg:hidden flex items-center justify-center h-8 w-8 rounded-md shrink-0",
            "text-muted-foreground hover:text-foreground hover:bg-muted",
            "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <Breadcrumbs />
      </div>

      {/* Right: client selector + theme + avatar */}
      <div className="flex items-center gap-2">
        <ClientSelector />
        <div className="h-5 w-px bg-border" aria-hidden="true" />
        <ThemeToggle />

        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="relative ml-1 flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Open user menu"
            >
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-primary text-primary-foreground text-[11px] font-bold">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-foreground hidden sm:block max-w-[120px] truncate">
                {user.name.split(" ")[0]}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
              <DropdownMenuLabel className="pb-2">
                <div className="flex items-start gap-2.5">
                  <Avatar className="h-8 w-8 mt-0.5">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-tight truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{user.email}</p>
                    <Badge
                      variant={isOwner ? "default" : "secondary"}
                      className="mt-1.5 text-[10px] h-4 px-1.5 capitalize"
                    >
                      {user.role}
                    </Badge>
                  </div>
                </div>
              </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={logout}
                className="text-destructive focus:text-destructive gap-2 cursor-pointer"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
