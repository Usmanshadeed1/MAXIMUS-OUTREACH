"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useClients } from "@/lib/hooks/use-clients";
import { useAuth } from "@/contexts/auth-context";
import { ClientCard } from "@/components/clients/client-card";
import { RoleGuard } from "@/components/auth/role-guard";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePageTitle } from "@/lib/hooks/use-page-title";

function ClientsGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border/60 bg-card p-5 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-5 w-14 rounded-full shrink-0" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-14 rounded-lg" />
            <Skeleton className="h-14 rounded-lg" />
          </div>
          <Skeleton className="h-8 rounded-md" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  const { isOwner } = useAuth();
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
        <Building2 className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">
        {hasSearch ? "No clients match your search" : "No clients yet"}
      </h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        {hasSearch
          ? "Try a different search term."
          : isOwner
          ? "Create your first client to start managing outreach campaigns."
          : "You haven't been assigned to any clients yet. Contact your administrator."}
      </p>
      {!hasSearch && isOwner && (
        <Link
          href="/clients/new"
          className={cn(buttonVariants({ variant: "default" }), "mt-6 gap-2")}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create First Client
        </Link>
      )}
    </div>
  );
}

export default function ClientsPage() {
  const { isOwner } = useAuth();
  const { data, isLoading, isError } = useClients();
  const [search, setSearch] = useState("");
  usePageTitle("Clients");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data?.items ?? [];
    return (data?.items ?? []).filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.business_type ?? "").toLowerCase().includes(q) ||
        (c.website ?? "").toLowerCase().includes(q)
    );
  }, [data, search]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clients</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isLoading
              ? "Loading clients…"
              : `${data?.total ?? 0} client${(data?.total ?? 0) !== 1 ? "s" : ""}`}
          </p>
        </div>

        <RoleGuard role="owner">
          <Link
            href="/clients/new"
            className={cn(buttonVariants({ variant: "default" }), "gap-2 shrink-0")}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create Client
          </Link>
        </RoleGuard>
      </div>

      {/* Search */}
      {!isLoading && (data?.total ?? 0) > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
          <Input
            placeholder="Search clients…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            aria-label="Search clients"
          />
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Failed to load clients. Please refresh the page.
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <ClientsGridSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState hasSearch={search.trim().length > 0} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((client) => (
            <ClientCard key={client.id} client={client} showEdit={isOwner} />
          ))}
        </div>
      )}
    </div>
  );
}
