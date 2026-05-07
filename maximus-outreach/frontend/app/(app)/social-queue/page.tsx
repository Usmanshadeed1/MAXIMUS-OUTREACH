"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Copy,
  Check,
  ExternalLink,
  CheckCheck,
  SkipForward,
  Loader2,
  Inbox,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePageTitle } from "@/lib/hooks/use-page-title";
import {
  useSocialQueue,
  useSocialQueueStats,
  useMarkSent,
  useSkipDm,
} from "@/lib/hooks/use-social-queue";
import { useClients } from "@/lib/hooks/use-clients";
import type { SocialDmQueueItem } from "@/types";

// ─── Platform config ──────────────────────────────────────────────────────────

const PLATFORMS: Record<string, { label: string; color: string; bg: string }> = {
  instagram: { label: "Instagram", color: "text-pink-400", bg: "bg-pink-500/10 border-pink-500/30" },
  facebook: { label: "Facebook", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/30" },
  linkedin: { label: "LinkedIn", color: "text-sky-400", bg: "bg-sky-500/10 border-sky-500/30" },
  tiktok: { label: "TikTok", color: "text-white", bg: "bg-zinc-800 border-zinc-600" },
  twitter: { label: "Twitter/X", color: "text-zinc-200", bg: "bg-zinc-800 border-zinc-600" },
  x: { label: "X", color: "text-zinc-200", bg: "bg-zinc-800 border-zinc-600" },
  snapchat: { label: "Snapchat", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30" },
  youtube: { label: "YouTube", color: "text-red-400", bg: "bg-red-500/10 border-red-500/30" },
};

function getPlatformCfg(p: string) {
  return PLATFORMS[p.toLowerCase()] ?? { label: p, color: "text-muted-foreground", bg: "bg-muted/20 border-border" };
}

// ─── Stat chip ────────────────────────────────────────────────────────────────

function StatChip({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4 min-w-[120px]">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-2xl font-bold mt-0.5", accent ?? "text-foreground")}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}

// ─── DM Card ─────────────────────────────────────────────────────────────────

interface DmCardProps {
  item: SocialDmQueueItem;
  isActive: boolean;
  onMarkSent: (id: string) => void;
  onSkip: (id: string) => void;
  isPending: boolean;
  sentId: string | null;
  skippedId: string | null;
}

function DmCard({ item, isActive, onMarkSent, onSkip, isPending, sentId, skippedId }: DmCardProps) {
  const [copied, setCopied] = useState(false);
  const platCfg = getPlatformCfg(item.platform);

  const isSending = isPending && sentId === item.id;
  const isSkipping = isPending && skippedId === item.id;

  const handleCopy = () => {
    const text = item.message_content;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        toast.success("Message copied!");
        setTimeout(() => setCopied(false), 2000);
      });
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      toast.success("Message copied!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl border bg-card transition-all duration-200",
        isActive ? "border-primary shadow-[0_0_0_2px_hsl(var(--primary)/0.2)]" : "border-border",
        (sentId === item.id || skippedId === item.id) && "opacity-50 scale-[0.98]"
      )}
    >
      <div className="px-5 py-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            {/* Lead + client names */}
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-sm font-semibold text-foreground truncate">
                {item.lead_name ?? "Unknown Lead"}
              </span>
              {item.client_name && (
                <span className="text-[11px] text-muted-foreground border border-border rounded px-1.5 py-0.5 shrink-0">
                  {item.client_name}
                </span>
              )}
            </div>
            {/* Platform + URL */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium", platCfg.bg, platCfg.color)}>
                {platCfg.label}
              </span>
              <span className="text-xs text-muted-foreground truncate max-w-[220px]">
                {item.profile_url}
              </span>
            </div>
          </div>
          {isActive && (
            <span className="text-[10px] text-primary font-medium shrink-0 bg-primary/10 px-2 py-0.5 rounded-full">
              Active
            </span>
          )}
        </div>

        {/* AI message block */}
        <div className="rounded-lg bg-muted/20 border border-border px-4 py-3 mb-4">
          <p className="text-[11px] text-primary font-medium mb-1.5 flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
            AI-generated message
          </p>
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
            {item.message_content}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleCopy}
            title="Copy message (C)"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
              copied
                ? "border-green-500/40 bg-green-500/10 text-green-400"
                : "border-border bg-background text-foreground hover:bg-muted/30"
            )}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied!" : "Copy"}
          </button>

          <a
            href={item.profile_url}
            target="_blank"
            rel="noopener noreferrer"
            title="Open profile (O)"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/30 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open Profile
          </a>

          <button
            type="button"
            onClick={() => onMarkSent(item.id)}
            disabled={isPending}
            title="Mark sent (S)"
            className="inline-flex items-center gap-1.5 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50"
          >
            {isSending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCheck className="h-3.5 w-3.5" />
            )}
            Mark Sent
          </button>

          <button
            type="button"
            onClick={() => onSkip(item.id)}
            disabled={isPending}
            title="Skip (N)"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors disabled:opacity-50"
          >
            {isSkipping ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <SkipForward className="h-3.5 w-3.5" />
            )}
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SocialQueuePage() {
  const [platformFilter, setPlatformFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [sentId, setSentId] = useState<string | null>(null);
  const [skippedId, setSkippedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  usePageTitle("Social DM Queue");

  const { data: items = [], isLoading } = useSocialQueue({
    platform: platformFilter || undefined,
    client_id: clientFilter || undefined,
    status: "pending",
    page_size: 100,
  });

  const { data: stats } = useSocialQueueStats(clientFilter || undefined);
  const { data: clientsData } = useClients();
  const clients = clientsData?.items ?? [];

  const markSentMutation = useMarkSent();
  const skipMutation = useSkipDm();

  const isPending = markSentMutation.isPending || skipMutation.isPending;

  const handleMarkSent = useCallback(
    (id: string) => {
      setSentId(id);
      markSentMutation.mutate(id, {
        onSuccess: () => {
          toast.success("Marked as sent");
          setSentId(null);
          setActiveIdx((i) => Math.max(0, i - 1));
        },
        onError: () => {
          toast.error("Failed to mark as sent");
          setSentId(null);
        },
      });
    },
    [markSentMutation]
  );

  const handleSkip = useCallback(
    (id: string) => {
      setSkippedId(id);
      skipMutation.mutate(id, {
        onSuccess: () => {
          toast.success("Skipped");
          setSkippedId(null);
          setActiveIdx((i) => Math.min(items.length - 2, i));
        },
        onError: () => {
          toast.error("Failed to skip");
          setSkippedId(null);
        },
      });
    },
    [skipMutation, items.length]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Don't fire when typing in inputs/textareas
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") return;
      const active = items[activeIdx];
      if (!active) return;

      if (e.key === "c" || e.key === "C") {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(active.message_content).then(() => toast.success("Message copied!"));
        } else {
          const ta = document.createElement("textarea");
          ta.value = active.message_content;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
          toast.success("Message copied!");
        }
      } else if (e.key === "o" || e.key === "O") {
        window.open(active.profile_url, "_blank", "noopener,noreferrer");
      } else if (e.key === "s" || e.key === "S") {
        handleMarkSent(active.id);
      } else if (e.key === "n" || e.key === "N") {
        handleSkip(active.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, activeIdx, handleMarkSent, handleSkip]);

  const platformOptions = Array.from(new Set(items.map((i) => i.platform))).sort();

  return (
    <div className="space-y-6" ref={containerRef}>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Social DM Queue</h1>
        <p className="text-sm text-muted-foreground mt-1">
          AI-generated messages ready to copy & send manually.
          <span className="ml-2 text-xs text-muted-foreground/60">
            Shortcuts: <kbd className="font-mono bg-muted px-1 rounded">C</kbd> copy ·{" "}
            <kbd className="font-mono bg-muted px-1 rounded">O</kbd> open ·{" "}
            <kbd className="font-mono bg-muted px-1 rounded">S</kbd> mark sent ·{" "}
            <kbd className="font-mono bg-muted px-1 rounded">N</kbd> next
          </span>
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="flex gap-3 flex-wrap">
          <StatChip label="Pending" value={stats.pending} accent="text-amber-400" />
          <StatChip label="Sent Today" value={stats.sent_today} accent="text-green-400" />
          <StatChip label="Skipped" value={stats.skipped} />
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        {/* Platform filter buttons */}
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setPlatformFilter("")}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
              !platformFilter
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            All Platforms
          </button>
          {platformOptions.map((p) => {
            const cfg = getPlatformCfg(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPlatformFilter(platformFilter === p ? "" : p)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                  platformFilter === p
                    ? `${cfg.bg} ${cfg.color}`
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>

        {/* Client filter */}
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">All Clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Queue list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 rounded-xl border border-dashed border-border">
          <Inbox className="h-10 w-10 text-muted-foreground/30" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">No pending DMs</p>
          <p className="text-xs text-muted-foreground/60">
            Items appear here when the outreach worker generates Social DM messages.
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-w-3xl">
          {/* Active item count */}
          <p className="text-xs text-muted-foreground">
            {items.length} pending · click a card or use keyboard shortcuts
          </p>
          {items.map((item, idx) => (
            <div key={item.id} onClick={() => setActiveIdx(idx)}>
              <DmCard
                item={item}
                isActive={idx === activeIdx}
                onMarkSent={handleMarkSent}
                onSkip={handleSkip}
                isPending={isPending}
                sentId={sentId}
                skippedId={skippedId}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
