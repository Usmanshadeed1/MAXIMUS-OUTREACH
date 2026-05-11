"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  CheckSquare,
  MessageCircle,
  BarChart3,
  Settings,
  Send,
  ChevronLeft,
  ChevronRight,
  Zap,
  X,
  LayoutTemplate,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

const mainNavItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Clients", href: "/clients", icon: Building2 },
  { label: "Social DM Queue", href: "/social-queue", icon: Send },
  { label: "Review Queue", href: "/review-queue", icon: CheckSquare },
  { label: "Conversations", href: "/conversations", icon: MessageCircle },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Templates", href: "/templates", icon: LayoutTemplate },
] as const;

const adminNavItems = [
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Users", href: "/users", icon: Users },
] as const;

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
};

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function NavItem({
  item,
  isActive,
  collapsed,
  badge,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
  badge?: number;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
        "transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
        isActive
          ? "bg-primary/[0.08] text-primary"
          : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground",
        collapsed && "justify-center"
      )}
    >
      {/* Active left-border indicator */}
      {isActive && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-primary"
          aria-hidden="true"
        />
      )}
      <div className="relative shrink-0">
        <Icon
          className={cn(
            "h-4 w-4 transition-colors",
            isActive ? "text-primary" : "text-sidebar-foreground/50"
          )}
          aria-hidden="true"
        />
        {/* Dot indicator when collapsed */}
        {collapsed && badge && badge > 0 && (
          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary" />
        )}
      </div>
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && badge !== undefined && <Badge count={badge} />}
    </Link>
  );
}

export function Sidebar({
  isOpen = false,
  onClose,
}: {
  isOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const { isOwner } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const prevPathname = useRef(pathname);

  // Close mobile drawer on navigation
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      onClose?.();
    }
  }, [pathname, onClose]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const { data: socialStats } = useQuery({
    queryKey: ["social-queue-stats"],
    queryFn: async () => {
      const { data } = await api.get<{ pending: number }>("/social-queue/stats");
      return data;
    },
    refetchInterval: 30_000,
  });

  const { data: reviewCount } = useQuery({
    queryKey: ["review-queue-count"],
    queryFn: async () => {
      const { data } = await api.get<{ count: number }>("/review-queue/count");
      return data;
    },
    refetchInterval: 30_000,
  });

  const badges: Record<string, number> = {
    "/social-queue": socialStats?.pending ?? 0,
    "/review-queue": reviewCount?.count ?? 0,
  };

  return (
    <aside
      aria-label="Application sidebar"
      className={cn(
        "flex flex-col border-r border-sidebar-border bg-sidebar shrink-0",
        // Mobile: fixed drawer, slides in/out
        "fixed inset-y-0 left-0 z-40 w-[220px]",
        "transition-[transform,width] duration-300 ease-in-out",
        isOpen ? "translate-x-0" : "-translate-x-full",
        // Desktop lg+: static position, collapsible width, always visible
        "lg:relative lg:translate-x-0 lg:min-h-screen",
        collapsed ? "lg:w-[60px]" : "lg:w-[220px]"
      )}
    >
      {/* ── Logo ── */}
      <div
        className={cn(
          "flex h-[60px] items-center border-b border-sidebar-border shrink-0 px-4",
          collapsed ? "justify-center" : "gap-3"
        )}
      >
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shrink-0 shadow-md shadow-blue-500/30">
          <Zap className="h-4 w-4 text-white" aria-hidden="true" />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-sidebar-foreground leading-none tracking-tight">
              Maximus
            </p>
            <p className="text-[10px] text-sidebar-foreground/40 uppercase tracking-widest mt-[3px]">
              Outreach
            </p>
          </div>
        )}
        {/* Mobile close button */}
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close navigation menu"
            className={cn(
              "lg:hidden flex items-center justify-center h-7 w-7 rounded-md",
              "text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent",
              "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              collapsed && "hidden"
            )}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* ── Main nav ── */}
      <nav
        className="flex-1 overflow-y-auto px-2 pt-3 pb-4 space-y-0.5"
        aria-label="Main navigation"
      >
        {mainNavItems.map((item) => (
          <NavItem
            key={item.href}
            item={item}
            isActive={isActive(item.href)}
            collapsed={collapsed}
            badge={badges[item.href]}
          />
        ))}

        {/* ── Admin section (owner only) ── */}
        {isOwner && (
          <>
            <div className={cn("pt-4 pb-1", collapsed ? "px-1" : "px-1")}>
              {!collapsed && (
                <p className="px-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/35">
                  Administration
                </p>
              )}
              {collapsed && (
                <div className="h-px bg-sidebar-border mx-1" />
              )}
            </div>
            {adminNavItems.map((item) => (
              <NavItem
                key={item.href}
                item={item}
                isActive={isActive(item.href)}
                collapsed={collapsed}
              />
            ))}
          </>
        )}
      </nav>

      {/* ── Collapse toggle (desktop only) ── */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={cn(
          "hidden lg:flex", // hidden on mobile
          "absolute -right-3 top-[72px] z-10",
          "h-6 w-6 items-center justify-center",
          "rounded-full border border-sidebar-border bg-sidebar shadow-sm",
          "text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent",
          "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
        ) : (
          <ChevronLeft className="h-3 w-3" aria-hidden="true" />
        )}
      </button>
    </aside>
  );
}
