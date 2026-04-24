"use client";

import { useAuth } from "@/contexts/auth-context";

interface RoleGuardProps {
  role: "owner";
  children: React.ReactNode;
  /** Render this instead of nothing when access is denied. Optional. */
  fallback?: React.ReactNode;
}

/**
 * Renders children only when the authenticated user has the required role.
 * For role="owner": renders nothing (or fallback) when user is a manager.
 * Should only be used inside authenticated routes (inside AppShell).
 */
export function RoleGuard({ role, children, fallback = null }: RoleGuardProps) {
  const { user, isOwner } = useAuth();

  if (!user) return null;

  if (role === "owner" && !isOwner) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
