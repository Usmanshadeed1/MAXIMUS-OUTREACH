"use client";

import { useState, useCallback } from "react";
import {
  CheckCheck,
  Trash2,
  Pencil,
  X,
  Send,
  Loader2,
  Inbox,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePageTitle } from "@/lib/hooks/use-page-title";
import {
  useReviewQueue,
  useReviewQueueCount,
  useApproveDraft,
  useEditDraft,
  useDiscardDraft,
  type ReviewQueueItem,
} from "@/lib/hooks/use-review-queue";
import { useClients } from "@/lib/hooks/use-clients";

// ─── Channel config ───────────────────────────────────────────────────────────

const CHANNEL_CFG: Record<string, { label: string; color: string; bg: string }> = {
  email:    { label: "Email",    color: "text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/30" },
  sms:      { label: "SMS",      color: "text-green-400",  bg: "bg-green-500/10 border-green-500/30"   },
  whatsapp: { label: "WhatsApp", color: "text-emerald-400",bg: "bg-emerald-500/10 border-emerald-500/30"},
  instagram:{ label: "Instagram",color: "text-pink-400",   bg: "bg-pink-500/10 border-pink-500/30"     },
  facebook: { label: "Facebook", color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/30"     },
  linkedin: { label: "LinkedIn", color: "text-sky-400",    bg: "bg-sky-500/10 border-sky-500/30"       },
  twitter:  { label: "Twitter",  color: "text-zinc-300",   bg: "bg-zinc-700 border-zinc-600"           },
};

function getChannelCfg(ch: string) {
  return CHANNEL_CFG[ch.toLowerCase()] ?? {
    label: ch, color: "text-muted-foreground", bg: "bg-muted/20 border-border",
  };
}

function formatRelative(dt: string) {
  const diff = Date.now() - new Date(dt).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Draft card ───────────────────────────────────────────────────────────────

interface DraftCardProps {
  item: ReviewQueueItem;
}

function DraftCard({ item }: DraftCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.content);
  const [discardConfirm, setDiscardConfirm] = useState(false);

  const approveMut = useApproveDraft();
  const editMut    = useEditDraft();
  const discardMut = useDiscardDraft();

  const busy = approveMut.isPending || editMut.isPending || discardMut.isPending;
  const ch   = getChannelCfg(item.channel);

  const handleApprove = () => {
    approveMut.mutate(item.id, {
      onSuccess: () => toast.success("Draft approved & sent"),
      onError:   () => toast.error("Failed to approve"),
    });
  };

  const handleEditSend = () => {
    if (!draft.trim()) return;
    editMut.mutate(
      { id: item.id, content: draft },
      {
        onSuccess: () => { toast.success("Edited & sent"); setEditing(false); },
        onError:   () => toast.error("Failed to send edited draft"),
      }
    );
  };

  const handleDiscard = () => {
    if (!discardConfirm) { setDiscardConfirm(true); return; }
    discardMut.mutate(item.id, {
      onSuccess: () => toast.success("Draft discarded"),
      onError:   () => toast.error("Failed to discard"),
    });
  };

  return (
    <div className="rounded-xl border border-border bg-card transition-all duration-150 hover:border-border/80">
      <div className="px-5 py-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium", ch.bg, ch.color)}>
              {ch.label}
            </span>
            {item.is_ai_generated && (
              <span className="inline-flex items-center rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                AI Draft
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {formatRelative(item.created_at)}
          </span>
        </div>

        {/* Content / edit area */}
        {editing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={5}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y"
          />
        ) : (
          <div className="rounded-lg bg-muted/20 border border-border px-4 py-3">
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
              {item.content}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {editing ? (
            <>
              <button
                type="button"
                onClick={handleEditSend}
                disabled={busy || !draft.trim()}
                className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
              >
                {editMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Send Edit
              </button>
              <button
                type="button"
                onClick={() => { setEditing(false); setDraft(item.content); }}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleApprove}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50"
              >
                {approveMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
                Approve & Send
              </button>
              <button
                type="button"
                onClick={() => setEditing(true)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/30 transition-colors disabled:opacity-50"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
              <button
                type="button"
                onClick={handleDiscard}
                disabled={busy}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
                  discardConfirm
                    ? "border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                    : "border-border bg-background text-muted-foreground hover:text-destructive"
                )}
              >
                {discardMut.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                {discardConfirm ? "Confirm Discard" : "Discard"}
              </button>
              {discardConfirm && (
                <button
                  type="button"
                  onClick={() => setDiscardConfirm(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReviewQueuePage() {
  const [clientFilter, setClientFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;
  usePageTitle("Review Queue");

  const { data, isLoading } = useReviewQueue({
    client_id: clientFilter || undefined,
    page,
    page_size: PAGE_SIZE,
  });

  const { data: countData } = useReviewQueueCount(clientFilter || undefined);
  const { data: clientsData } = useClients();
  const clients = clientsData?.items ?? [];

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Filter by channel client-side (no dedicated backend param)
  const filtered = channelFilter
    ? items.filter((i) => i.channel.toLowerCase() === channelFilter)
    : items;

  const channelOptions = Array.from(new Set(items.map((i) => i.channel.toLowerCase()))).sort();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            Review Queue
            {(countData?.count ?? 0) > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-primary h-6 px-2 text-xs font-bold text-primary-foreground">
                {countData!.count}
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Approve, edit, or discard AI-generated reply drafts before they send.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        {/* Channel filter */}
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => { setChannelFilter(""); setPage(1); }}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
              !channelFilter
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            All Channels
          </button>
          {channelOptions.map((ch) => {
            const cfg = getChannelCfg(ch);
            return (
              <button
                key={ch}
                type="button"
                onClick={() => { setChannelFilter(channelFilter === ch ? "" : ch); setPage(1); }}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                  channelFilter === ch
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
          onChange={(e) => { setClientFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">All Clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Draft list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 rounded-xl border border-dashed border-border">
          <Inbox className="h-10 w-10 text-muted-foreground/30" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">No drafts pending review</p>
          <p className="text-xs text-muted-foreground/60">
            AI-generated replies appear here for approval before sending.
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-w-3xl">
          <p className="text-xs text-muted-foreground">
            {total} draft{total !== 1 ? "s" : ""} pending · page {page} of {totalPages}
          </p>
          {filtered.map((item) => (
            <DraftCard key={item.id} item={item} />
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
              >
                ← Previous
              </button>
              <span className="text-xs text-muted-foreground">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
