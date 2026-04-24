"use client";

import Link from "next/link";
import {
  Play,
  Pause,
  RotateCcw,
  Users,
  Send,
  MessageSquare,
  Zap,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Campaign } from "@/types";

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; classes: string; dot: string }> = {
  draft: {
    label: "Draft",
    classes: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    dot: "bg-zinc-400",
  },
  active: {
    label: "Active",
    classes: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    dot: "bg-emerald-400",
  },
  paused: {
    label: "Paused",
    classes: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    dot: "bg-amber-400",
  },
  completed: {
    label: "Completed",
    classes: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    dot: "bg-blue-400",
  },
  archived: {
    label: "Archived",
    classes: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground",
  },
};

// ─── Stat chip ────────────────────────────────────────────────────────────────

function StatChip({
  icon: Icon,
  value,
  label,
  color = "muted",
}: {
  icon: React.ElementType;
  value: number;
  label: string;
  color?: "muted" | "emerald" | "blue" | "amber";
}) {
  const colorMap = {
    muted: "text-muted-foreground",
    emerald: "text-emerald-400",
    blue: "text-blue-400",
    amber: "text-amber-400",
  };
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className={cn("flex items-center gap-1 text-sm font-semibold tabular-nums", colorMap[color])}>
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {value.toLocaleString()}
      </div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface CampaignCardProps {
  campaign: Campaign;
  onStart?: (id: string) => void;
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  isPending?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CampaignCard({
  campaign,
  onStart,
  onPause,
  onResume,
  isPending = false,
}: CampaignCardProps) {
  const sc = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG.draft;
  const stats = campaign.stats;
  const stepsCount = campaign.steps?.length ?? 0;

  const replyRate =
    stats && stats.total_enrolled > 0
      ? ((stats.total_replied / stats.total_enrolled) * 100).toFixed(1)
      : "0";

  return (
    <div className="rounded-xl border border-border bg-card hover:border-primary/30 transition-colors">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Status dot */}
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium",
                  sc.classes
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />
                {sc.label}
              </span>
              {campaign.status === "active" && (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                  </span>
                  Running
                </span>
              )}
            </div>
            <Link
              href={`/campaigns/${campaign.id}`}
              className="block mt-1.5 text-base font-semibold text-foreground hover:text-primary transition-colors leading-tight truncate"
            >
              {campaign.name}
            </Link>
            {campaign.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {campaign.description}
              </p>
            )}
          </div>

          {/* Quick actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isPending ? (
              <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
            ) : (
              <>
                {campaign.status === "draft" && onStart && (
                  <button
                    onClick={() => onStart(campaign.id)}
                    title="Start campaign"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "h-7 gap-1.5 text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                    )}
                  >
                    <Play className="h-3 w-3" />
                    Start
                  </button>
                )}
                {campaign.status === "active" && onPause && (
                  <button
                    onClick={() => onPause(campaign.id)}
                    title="Pause campaign"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "h-7 gap-1.5 text-xs text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                    )}
                  >
                    <Pause className="h-3 w-3" />
                    Pause
                  </button>
                )}
                {campaign.status === "paused" && onResume && (
                  <button
                    onClick={() => onResume(campaign.id)}
                    title="Resume campaign"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "h-7 gap-1.5 text-xs text-blue-400 border-blue-500/30 hover:bg-blue-500/10"
                    )}
                  >
                    <RotateCcw className="h-3 w-3" />
                    Resume
                  </button>
                )}
                <Link
                  href={`/campaigns/${campaign.id}`}
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" }),
                    "h-7 text-xs text-muted-foreground"
                  )}
                >
                  View
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="px-5 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-5 divide-x divide-border">
          <StatChip
            icon={Users}
            value={stats?.total_enrolled ?? campaign.total_enrolled ?? 0}
            label="Enrolled"
            color="muted"
          />
          <div className="pl-5">
            <StatChip
              icon={Zap}
              value={stats?.total_activated ?? campaign.total_activated ?? 0}
              label="Activated"
              color="blue"
            />
          </div>
          <div className="pl-5">
            <StatChip
              icon={Send}
              value={stats?.total_queued ?? 0}
              label="Queued"
              color="muted"
            />
          </div>
          <div className="pl-5">
            <StatChip
              icon={MessageSquare}
              value={stats?.total_replied ?? 0}
              label="Replies"
              color="emerald"
            />
          </div>
          <div className="pl-5">
            <StatChip
              icon={CheckCircle2}
              value={stats?.total_completed ?? 0}
              label="Completed"
              color="muted"
            />
          </div>
        </div>

        {/* Right meta */}
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <p className="text-sm font-semibold text-foreground tabular-nums">{replyRate}%</p>
          <p className="text-[10px] text-muted-foreground">Reply rate</p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-2.5 border-t border-border flex items-center gap-3 text-[11px] text-muted-foreground">
        <span>{stepsCount} step{stepsCount !== 1 ? "s" : ""}</span>
        <span>·</span>
        <span className="capitalize">{campaign.pacing_mode.replace("_", " ")}</span>
        <span>·</span>
        <span>Created {new Date(campaign.created_at).toLocaleDateString()}</span>
      </div>
    </div>
  );
}
