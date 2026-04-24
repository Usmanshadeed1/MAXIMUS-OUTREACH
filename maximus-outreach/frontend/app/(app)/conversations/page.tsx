"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send,
  XCircle,
  Loader2,
  MessageSquare,
  Bot,
  User,
  ChevronLeft,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePageTitle } from "@/lib/hooks/use-page-title";
import {
  useConversations,
  useConversation,
  useManualReply,
  useCloseConversation,
  type ConversationResponse,
  type MessageResponse,
} from "@/lib/hooks/use-conversations";
import { useClients } from "@/lib/hooks/use-clients";

// ─── Channel config ───────────────────────────────────────────────────────────

const CHANNEL_CFG: Record<string, { label: string; color: string; bg: string }> = {
  email:    { label: "Email",    color: "text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/30"  },
  sms:      { label: "SMS",      color: "text-green-400",  bg: "bg-green-500/10 border-green-500/30"    },
  whatsapp: { label: "WhatsApp", color: "text-emerald-400",bg: "bg-emerald-500/10 border-emerald-500/30"},
  instagram:{ label: "Instagram",color: "text-pink-400",   bg: "bg-pink-500/10 border-pink-500/30"      },
  facebook: { label: "Facebook", color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/30"      },
  linkedin: { label: "LinkedIn", color: "text-sky-400",    bg: "bg-sky-500/10 border-sky-500/30"        },
  twitter:  { label: "Twitter",  color: "text-zinc-300",   bg: "bg-zinc-700 border-zinc-600"            },
};

function getChannelCfg(ch: string) {
  return CHANNEL_CFG[ch?.toLowerCase()] ?? {
    label: ch ?? "Unknown", color: "text-muted-foreground", bg: "bg-muted/20 border-border",
  };
}

function formatTime(dt: string) {
  return new Date(dt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dt: string) {
  return new Date(dt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function formatRelative(dt: string) {
  const diff = Date.now() - new Date(dt).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return formatDate(dt);
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: MessageResponse }) {
  const isOut = msg.direction === "outbound";
  return (
    <div className={cn("flex gap-2 max-w-[80%]", isOut ? "ml-auto flex-row-reverse" : "mr-auto")}>
      {/* Avatar */}
      <div className={cn(
        "h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-xs mt-1",
        isOut ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
      )}>
        {isOut
          ? (msg.is_ai_generated ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />)
          : <MessageSquare className="h-3.5 w-3.5" />}
      </div>

      <div className="space-y-1">
        {/* Bubble */}
        <div className={cn(
          "rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-line",
          isOut
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-muted/40 border border-border text-foreground rounded-tl-sm"
        )}>
          {msg.content}
        </div>

        {/* Meta */}
        <div className={cn("flex items-center gap-2 text-[10px] text-muted-foreground", isOut && "justify-end")}>
          {msg.is_ai_generated && (
            <span className="text-primary/70">AI</span>
          )}
          <span>{formatTime(msg.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Conversation sidebar item ────────────────────────────────────────────────

function ConvItem({
  conv,
  isActive,
  onClick,
}: {
  conv: ConversationResponse;
  isActive: boolean;
  onClick: () => void;
}) {
  const ch = getChannelCfg(conv.channel);
  const lastMsg = conv.messages?.[conv.messages.length - 1];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3 border-b border-border/40 transition-colors",
        isActive ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-muted/20"
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className={cn("inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium", ch.bg, ch.color)}>
          {ch.label}
        </span>
        <span className="text-[10px] text-muted-foreground shrink-0">
          {formatRelative(conv.updated_at)}
        </span>
      </div>
      {lastMsg ? (
        <p className="text-xs text-muted-foreground truncate">{lastMsg.content}</p>
      ) : (
        <p className="text-xs text-muted-foreground/40 italic">No messages</p>
      )}
      {conv.status === "closed" && (
        <span className="text-[10px] text-muted-foreground/50 mt-0.5 block">Closed</span>
      )}
    </button>
  );
}

// ─── Thread panel ─────────────────────────────────────────────────────────────

function ThreadPanel({ convId, onBack }: { convId: string; onBack: () => void }) {
  const { data: conv, isLoading } = useConversation(convId);
  const replyMut = useManualReply();
  const closeMut = useCloseConversation();
  const [replyText, setReplyText] = useState("");
  const [closeConfirm, setCloseConfirm] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conv?.messages?.length]);

  const handleReply = () => {
    if (!replyText.trim() || !conv) return;
    replyMut.mutate(
      { id: conv.id, content: replyText },
      {
        onSuccess: () => { toast.success("Reply sent"); setReplyText(""); },
        onError:   () => toast.error("Failed to send reply"),
      }
    );
  };

  const handleClose = () => {
    if (!closeConfirm) { setCloseConfirm(true); return; }
    closeMut.mutate(convId, {
      onSuccess: () => { toast.success("Conversation closed"); setCloseConfirm(false); },
      onError:   () => toast.error("Failed to close"),
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 p-6 space-y-3">
        {[1,2,3,4].map(n => <Skeleton key={n} className="h-12 w-3/4 rounded-xl" />)}
      </div>
    );
  }
  if (!conv) return null;

  const ch = getChannelCfg(conv.channel);
  const isClosed = conv.status === "closed";
  const busy = replyMut.isPending || closeMut.isPending;

  return (
    <div className="flex flex-col h-full">
      {/* Thread header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="md:hidden rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium", ch.bg, ch.color)}>
          {ch.label}
        </span>
        <span className={cn(
          "text-[11px] font-medium px-2 py-0.5 rounded-full border",
          isClosed
            ? "border-muted/40 text-muted-foreground"
            : "border-green-500/30 bg-green-500/10 text-green-400"
        )}>
          {isClosed ? "Closed" : "Open"}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          {formatDate(conv.created_at)}
        </span>
        {!isClosed && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={busy}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
                closeConfirm
                  ? "border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              )}
            >
              {closeMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
              {closeConfirm ? "Confirm Close" : "Close"}
            </button>
            {closeConfirm && (
              <button
                type="button"
                onClick={() => setCloseConfirm(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {conv.messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-10">No messages yet.</p>
        )}
        {conv.messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Reply box */}
      {!isClosed && (
        <div className="shrink-0 border-t border-border px-5 py-4">
          <div className="flex gap-2 items-end">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleReply();
              }}
              placeholder="Type a reply… (Ctrl+Enter to send)"
              rows={3}
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
            <button
              type="button"
              onClick={handleReply}
              disabled={busy || !replyText.trim()}
              className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-4 py-2.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 self-end"
            >
              {replyMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Send
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground/50 mt-1">Ctrl+Enter to send</p>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ConversationsPage() {
  const [clientFilter, setClientFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  usePageTitle("Conversations");

  const { data, isLoading, isError } = useConversations({
    client_id: clientFilter || undefined,
    channel:   channelFilter || undefined,
    status:    statusFilter  || undefined,
    page,
    page_size: 50,
  });

  const { data: clientsData } = useClients();
  const clients = clientsData?.items ?? [];

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 50));

  const channelOptions = Array.from(new Set(items.map((i) => i.channel?.toLowerCase()).filter(Boolean))).sort();

  return (
    <div className="flex flex-col gap-0 h-[calc(100dvh-7rem)] sm:h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="shrink-0 mb-4">
        <h1 className="text-2xl font-bold text-foreground">Conversations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          View threads and send manual replies across all channels.
        </p>
      </div>

      {/* Filters */}
      <div className="shrink-0 flex gap-3 flex-wrap items-center mb-4">
        {/* Status */}
        {["open", "closed", ""].map((s) => (
          <button
            key={s || "all"}
            type="button"
            onClick={() => { setStatusFilter(s); setPage(1); setSelectedId(null); }}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
              statusFilter === s
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {s === "open" ? "Open" : s === "closed" ? "Closed" : "All"}
          </button>
        ))}

        {/* Channel */}
        {channelOptions.map((ch) => {
          const cfg = getChannelCfg(ch);
          return (
            <button
              key={ch}
              type="button"
              onClick={() => { setChannelFilter(channelFilter === ch ? "" : ch); setPage(1); setSelectedId(null); }}
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

        {/* Client */}
        <select
          value={clientFilter}
          onChange={(e) => { setClientFilter(e.target.value); setPage(1); setSelectedId(null); }}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">All Clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Two-pane layout */}
      <div className="flex flex-1 gap-0 rounded-xl border border-border overflow-hidden min-h-0">
        {/* Sidebar — conversation list */}
        <div className={cn(
          "flex flex-col border-r border-border",
          selectedId ? "hidden md:flex w-80 shrink-0" : "flex w-full md:w-80 md:shrink-0"
        )}>
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[1,2,3,4,5].map(n => <Skeleton key={n} className="h-16 w-full rounded-lg" />)}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center gap-2 flex-1 py-12 px-4">
              <p className="text-sm text-destructive text-center">Failed to load conversations</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 flex-1 py-12 px-4">
              <MessageSquare className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground text-center">No conversations found</p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto">
                {items.map((conv) => (
                  <ConvItem
                    key={conv.id}
                    conv={conv}
                    isActive={conv.id === selectedId}
                    onClick={() => setSelectedId(conv.id)}
                  />
                ))}
              </div>
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="shrink-0 flex items-center justify-between px-4 py-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
                  >
                    ← Prev
                  </button>
                  <span className="text-xs text-muted-foreground">{page}/{totalPages}</span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Thread panel */}
        <div className={cn("flex-1 min-w-0", selectedId ? "flex flex-col" : "hidden md:flex md:flex-col")}>
          {selectedId ? (
            <ThreadPanel convId={selectedId} onBack={() => setSelectedId(null)} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <MessageSquare className="h-10 w-10 opacity-20" />
              <p className="text-sm">Select a conversation</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
