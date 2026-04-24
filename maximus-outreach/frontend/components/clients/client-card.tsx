"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Building2, Users, Zap, ArrowRight, Pencil, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Client } from "@/types";

interface ClientCardProps {
  client: Client;
  showEdit?: boolean;
}

export function ClientCard({ client, showEdit = false }: ClientCardProps) {
  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-xl border bg-card overflow-hidden",
        "border-border shadow-sm",
        "transition-all duration-200 ease-out",
        "hover:border-primary/50 hover:shadow-md hover:shadow-primary/10 hover:-translate-y-px",
        !client.is_active && "opacity-50"
      )}
    >
      {/* Subtle top blue line — always visible, intensifies on hover */}
      <div
        className="h-[2px] w-full shrink-0"
        style={{
          background:
            "linear-gradient(90deg, transparent, oklch(0.546 0.235 264.376 / 0.4) 40%, oklch(0.546 0.235 264.376 / 0.7) 60%, transparent)",
        }}
        aria-hidden="true"
      />

      <div className="flex flex-col gap-0 p-5 flex-1">
        {/* Header row: icon + name + badge */}
        <div className="flex items-start gap-3 mb-4">
          <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Building2 className="h-[18px] w-[18px] text-primary" aria-hidden="true" />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm text-foreground leading-tight truncate">
              {client.name}
            </h3>
            <p className="text-xs text-muted-foreground mt-[3px] truncate">
              {client.business_type || "General Business"}
            </p>
          </div>

          <Badge
            variant={client.is_active ? "default" : "secondary"}
            className="shrink-0 text-[10px] font-semibold px-2 py-0.5"
          >
            {client.is_active ? "Active" : "Inactive"}
          </Badge>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <StatCell icon={Users} label="Leads" value={client.lead_count ?? 0} />
          <StatCell icon={Zap} label="Campaigns" value={client.active_campaigns_count ?? 0} />
        </div>

        {/* Website — if present */}
        {client.website ? (
          <div className="flex items-center gap-1.5 mb-4">
            <Globe className="h-3 w-3 text-muted-foreground shrink-0" aria-hidden="true" />
            <span className="text-xs text-muted-foreground truncate">
              {client.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </span>
          </div>
        ) : (
          <div className="mb-4" />
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-auto pt-1 border-t border-border/60">
          <Link
            href={`/clients/${client.id}`}
            className={cn(
              buttonVariants({ variant: "secondary", size: "sm" }),
              "flex-1 justify-center gap-1.5 text-xs font-medium mt-3"
            )}
          >
            View details
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          {showEdit && (
            <Link
              href={`/clients/${client.id}/edit`}
              aria-label={`Edit ${client.name}`}
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "px-2.5 mt-3"
              )}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCell({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg bg-background border border-border/80 px-3 py-2.5 flex items-center gap-3">
      <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center shrink-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold leading-none">
          {label}
        </p>
        <p className="text-lg font-bold text-foreground tabular-nums mt-0.5 leading-none">
          {value.toLocaleString()}
        </p>
      </div>
    </div>
  );
}
