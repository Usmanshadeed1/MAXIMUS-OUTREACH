"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  Loader2,
  Zap,
  Users,
  ListFilter,
  Settings2,
  ScrollText,
  CheckCircle2,
  XCircle,
  Clock,
  Mail,
  MessageSquare,
  Share2,
  Eye,
  MousePointerClick,
} from "lucide-react";import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePageTitle } from "@/lib/hooks/use-page-title";
import {
  useCampaign,
  useUpdateCampaign,
  useDeleteCampaign,
  useStartCampaign,
  usePauseCampaign,
  useResumeCampaign,
  useAddStep,
  useUpdateStep,
  useDeleteStep,
  useEnrollLeads,
  usePacingStatus,
  useCampaignLogs,
  useSendNow,
  type PacingStatus,
  type StepCreatePayload,
  type StepUpdatePayload,
  type OutreachLogEntry,
} from "@/lib/hooks/use-campaigns";
import { PacingConfig, type PacingConfigValue } from "@/components/campaigns/pacing-config";
import { StepBuilder } from "@/components/campaigns/step-builder";
import type { Campaign } from "@/types";

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20" },
  active: { label: "Active", className: "bg-green-500/15 text-green-400 border-green-500/20" },
  paused: { label: "Paused", className: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
  completed: { label: "Completed", className: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
  archived: { label: "Archived", className: "bg-zinc-600/15 text-zinc-500 border-zinc-600/20" },
};

// ─── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({ campaign }: { campaign: Campaign }) {
  const rows: [string, string | number | boolean][] = [
    ["Status", campaign.status],
    ["Stop on reply", campaign.stop_on_reply ? "Yes" : "No"],
    ["Max attempts", campaign.max_attempts],
    [
      "Repeat delay",
      campaign.max_attempts > 1
        ? `${campaign.repeat_delay_days} days`
        : "Not used when max attempts is 1",
    ],
    ["Total enrolled", campaign.total_enrolled.toLocaleString()],
    ["Total activated", campaign.total_activated.toLocaleString()],
    ["Created", new Date(campaign.created_at).toLocaleDateString()],
    ["Last updated", new Date(campaign.updated_at).toLocaleDateString()],
  ];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden max-w-2xl">
      <dl className="divide-y divide-border">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center gap-4 px-5 py-3">
            <dt className="w-40 shrink-0 text-xs font-medium text-muted-foreground">{label}</dt>
            <dd className="text-sm text-foreground capitalize">{String(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ─── Logs tab ─────────────────────────────────────────────────────────────────

const CHANNEL_ICON: Record<string, React.ElementType> = {
  email: Mail,
  sms: MessageSquare,
  whatsapp: MessageSquare,
  social_dm: Share2,
};

const STATUS_STYLE: Record<string, string> = {
  sent:      "bg-green-500/10 text-green-400 border-green-500/20",
  delivered: "bg-green-500/10 text-green-400 border-green-500/20",
  pending:   "bg-amber-500/10 text-amber-400 border-amber-500/20",
  scheduled: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  failed:    "bg-rose-500/10 text-rose-400 border-rose-500/20",
  skipped:   "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

const STATUS_ICON: Record<string, React.ElementType> = {
  sent:      CheckCircle2,
  delivered: CheckCircle2,
  pending:   Clock,
  scheduled: Clock,
  failed:    XCircle,
  skipped:   XCircle,
};

function fmt(iso: string | null) {
  if (!iso) return "—";
  // Backend returns UTC timestamps without Z — append it so JS parses as UTC and displays in local time
  const s = iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z";
  const d = new Date(s);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function LogRow({ log }: { log: OutreachLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const ChanIcon = CHANNEL_ICON[log.channel] ?? MessageSquare;
  const StatusIcon = STATUS_ICON[log.status] ?? Clock;
  const statusStyle = STATUS_STYLE[log.status] ?? "bg-muted text-muted-foreground border-border";

  return (
    <>
      <tr
        className="border-b border-border hover:bg-muted/10 cursor-pointer transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Lead */}
        <td className="px-4 py-3 text-sm text-foreground font-medium whitespace-nowrap max-w-[160px] truncate">
          {log.lead_name}
        </td>
        {/* Channel */}
        <td className="px-4 py-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground capitalize">
            <ChanIcon className="h-3.5 w-3.5" />
            {log.channel === "social_dm" ? "Social DM" : log.channel}
          </span>
        </td>
        {/* Status */}
        <td className="px-4 py-3">
          <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium capitalize", statusStyle)}>
            <StatusIcon className="h-3 w-3" />
            {log.channel === "social_dm" && log.status === "skipped" ? "Manual queue" : log.status}
          </span>
        </td>
        {/* Sent at */}
        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
          {fmt(log.sent_at ?? log.scheduled_at)}
        </td>
        {/* Tracking */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {log.opened_at && (
              <span className="flex items-center gap-1 text-emerald-400">
                <Eye className="h-3 w-3" /> Opened
              </span>
            )}
            {log.clicked_at && (
              <span className="flex items-center gap-1 text-blue-400">
                <MousePointerClick className="h-3 w-3" /> Clicked
              </span>
            )}
            {!log.opened_at && !log.clicked_at && "—"}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-border bg-muted/5">
          <td colSpan={5} className="px-4 pb-4 pt-2">
            {log.subject && (
              <p className="text-xs text-muted-foreground mb-1">
                <span className="font-medium text-foreground">Subject:</span> {log.subject}
              </p>
            )}
            {log.message_content ? (
              <pre className="text-xs text-foreground whitespace-pre-wrap font-sans bg-muted/20 rounded-md border border-border px-3 py-2 max-h-40 overflow-y-auto">
                {log.message_content}
              </pre>
            ) : null}
            {log.error_message && (
              <p className="mt-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-md px-3 py-2">
                <span className="font-medium">Error:</span> {log.error_message}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-4 text-[10px] text-muted-foreground">
              {log.sent_at && <span>Sent: {fmt(log.sent_at)}</span>}
              {log.opened_at && <span>Opened: {fmt(log.opened_at)}</span>}
              {log.clicked_at && <span>Clicked: {fmt(log.clicked_at)}</span>}
              {log.ai_model_used && <span>AI: {log.ai_model_used}</span>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function LogsTab({ campaignId }: { campaignId: string }) {
  const [channel, setChannel] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useCampaignLogs(campaignId, {
    channel: channel || undefined,
    status: status || undefined,
    page,
  });

  const handleFilter = (newChannel: string, newStatus: string) => {
    setPage(1);
    setChannel(newChannel);
    setStatus(newStatus);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={channel}
          onChange={(e) => handleFilter(e.target.value, status)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">All Channels</option>
          <option value="email">Email</option>
          <option value="sms">SMS</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="social_dm">Social DM</option>
        </select>
        <select
          value={status}
          onChange={(e) => handleFilter(channel, e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">All Statuses</option>
          <option value="sent">Sent</option>
          <option value="delivered">Delivered</option>
          <option value="pending">Pending</option>
          <option value="scheduled">Scheduled</option>
          <option value="failed">Failed</option>
          <option value="skipped">Skipped</option>
        </select>
        {(channel || status) && (
          <button
            type="button"
            onClick={() => handleFilter("", "")}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Clear filters
          </button>
        )}
        {data && (
          <span className="ml-auto text-xs text-muted-foreground">
            {data.total.toLocaleString()} {data.total === 1 ? "entry" : "entries"}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
            Loading logs…
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <ScrollText className="h-8 w-8 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-foreground">No log entries yet</p>
            <p className="text-xs mt-1">Messages will appear here once the campaign starts sending.</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="border-b border-border bg-muted/20">
              <tr>
                <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Lead</th>
                <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Channel</th>
                <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Date</th>
                <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Tracking</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((log) => (
                <LogRow key={log.id} log={log} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1")}
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {data.total_pages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
            disabled={page === data.total_pages}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1")}
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}


// ─── Pacing tab ───────────────────────────────────────────────────────────────

function PacingTab({
  campaign,
  pacing,
}: {
  campaign: Campaign;
  pacing: PacingStatus | undefined;
}) {
  const updateMutation = useUpdateCampaign(campaign.id, campaign.client_id);
  const [value, setValue] = useState<PacingConfigValue>({
    pacing_mode: campaign.pacing_mode,
    pacing_leads_per_day: campaign.pacing_leads_per_day ?? {},
    send_window_start: campaign.send_window_start,
    send_window_end: campaign.send_window_end,
    send_timezone: campaign.send_timezone,
  });
  const [dirty, setDirty] = useState(false);

  const handleChange = (v: PacingConfigValue) => {
    setValue(v);
    setDirty(true);
  };

  const handleSave = () => {
    updateMutation.mutate(
      {
        name: campaign.name,
        ...value,
      },
      {
        onSuccess: () => {
          toast.success("Pacing saved");
          setDirty(false);
        },
        onError: () => toast.error("Failed to save pacing"),
      }
    );
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <PacingConfig
        value={value}
        onChange={handleChange}
        totalLeads={campaign.total_enrolled}
        totalActivated={pacing?.total_activated ?? campaign.total_activated}
        disabled={campaign.status === "completed" || campaign.status === "archived"}
      />
      {dirty && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className={cn(buttonVariants({ variant: "default", size: "sm" }), "gap-2")}
          >
            {updateMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save Pacing
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Enroll tab ───────────────────────────────────────────────────────────────

const LEAD_STATUSES = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "replied", label: "Replied" },
  { value: "no_response", label: "No Response" },
  { value: "unsubscribed", label: "Unsubscribed" },
];

function EnrollTab({ campaign }: { campaign: Campaign }) {
  const [mode, setMode] = useState<"status" | "ids">("status");
  const [filterStatus, setFilterStatus] = useState("new");
  const [leadIds, setLeadIds] = useState("");
  const enrollMutation = useEnrollLeads(campaign.id, campaign.client_id);

  const handleEnroll = () => {
    const payload =
      mode === "status"
        ? { filter_status: filterStatus }
        : {
            lead_ids: leadIds
              .split(/[\n,]+/)
              .map((s) => s.trim())
              .filter(Boolean),
          };

    enrollMutation.mutate(payload, {
      onSuccess: (result) => {
        toast.success(
          `Enrolled ${result.enrolled} leads${result.skipped_already_enrolled ? ` (${result.skipped_already_enrolled} already enrolled)` : ""}`
        );
        setLeadIds("");
      },
      onError: () => toast.error("Enrollment failed"),
    });
  };

  return (
    <div className="space-y-5 max-w-xl">
      {/* Mode tabs */}
      <div className="flex gap-2">
        {(["status", "ids"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "px-4 py-1.5 rounded-md text-sm font-medium transition-colors border",
              mode === m
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {m === "status" ? (
              <span className="flex items-center gap-1.5">
                <ListFilter className="h-3.5 w-3.5" /> By Status
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> By Lead IDs
              </span>
            )}
          </button>
        ))}
      </div>

      {mode === "status" ? (
        <div className="rounded-xl border border-border bg-card px-5 py-4 space-y-3">
          <label className="block text-xs font-medium text-muted-foreground">
            Enroll all leads with status
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {LEAD_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            All leads matching this status will be enrolled into the campaign sequence.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card px-5 py-4 space-y-3">
          <label className="block text-xs font-medium text-muted-foreground">
            Lead IDs (one per line or comma-separated)
          </label>
          <textarea
            rows={6}
            value={leadIds}
            onChange={(e) => setLeadIds(e.target.value)}
            placeholder="Paste lead UUIDs here…"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none font-mono text-xs"
          />
        </div>
      )}

      <button
        type="button"
        onClick={handleEnroll}
        disabled={enrollMutation.isPending || (mode === "ids" && !leadIds.trim())}
        className={cn(buttonVariants({ variant: "default", size: "sm" }), "gap-2")}
      >
        {enrollMutation.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Users className="h-3.5 w-3.5" />
        )}
        Enroll Leads
      </button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  usePageTitle("Campaign");

  const { data: campaign, isLoading, isError } = useCampaign(id);
  const { data: pacingStatus } = usePacingStatus(id);

  const [confirmStartOpen, setConfirmStartOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const startMutation = useStartCampaign(campaign?.client_id ?? "");
  const pauseMutation = usePauseCampaign(campaign?.client_id ?? "");
  const resumeMutation = useResumeCampaign(campaign?.client_id ?? "");
  const deleteMutation = useDeleteCampaign(campaign?.client_id ?? "");
  const sendNowMutation = useSendNow(id, campaign?.client_id ?? "");
  const addStepMutation = useAddStep(id, campaign?.client_id ?? "");
  const updateStepMutation = useUpdateStep(id, campaign?.client_id ?? "");
  const deleteStepMutation = useDeleteStep(id, campaign?.client_id ?? "");

  const isActionPending =
    startMutation.isPending || pauseMutation.isPending || resumeMutation.isPending || sendNowMutation.isPending;

  // ── Step reorder helpers (local optimistic swap) ──
  const handleMoveUp = (stepId: string) => {
    if (!campaign?.steps) return;
    const sorted = [...campaign.steps].sort((a, b) => a.step_order - b.step_order);
    const idx = sorted.findIndex((s) => s.id === stepId);
    if (idx <= 0) return;
    const prev = sorted[idx - 1];
    updateStepMutation.mutate({ stepId, payload: { step_order: prev.step_order } });
    updateStepMutation.mutate({ stepId: prev.id, payload: { step_order: sorted[idx].step_order } });
  };

  const handleMoveDown = (stepId: string) => {
    if (!campaign?.steps) return;
    const sorted = [...campaign.steps].sort((a, b) => a.step_order - b.step_order);
    const idx = sorted.findIndex((s) => s.id === stepId);
    if (idx < 0 || idx >= sorted.length - 1) return;
    const next = sorted[idx + 1];
    updateStepMutation.mutate({ stepId, payload: { step_order: next.step_order } });
    updateStepMutation.mutate({ stepId: next.id, payload: { step_order: sorted[idx].step_order } });
  };

  // ── Delete campaign ──
  const handleDelete = () => {
    if (!campaign) return;
    deleteMutation.mutate(campaign.id, {
      onSuccess: () => {
        toast.success("Campaign deleted");
        router.push(`/clients/${campaign.client_id}`);
      },
      onError: () => toast.error("Failed to delete campaign"),
    });
  };

  // ─── Loading ───────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isError || !campaign) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 pt-20 text-muted-foreground">
        <p>Campaign not found.</p>
        <Link href="/clients" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Back to Clients
        </Link>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG.draft;
  const isEditable = campaign.status === "draft" || campaign.status === "paused";

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">
      {/* Back link */}
      <Link
        href={`/clients/${campaign.client_id}`}
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "-ml-2 gap-1.5 text-muted-foreground"
        )}
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Client
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">{campaign.name}</h1>
            <Badge className={cn("text-xs border", statusCfg.className)}>
              {campaign.status === "active" && (
                <span className="mr-1 h-1.5 w-1.5 rounded-full bg-current inline-block animate-pulse" />
              )}
              {statusCfg.label}
            </Badge>
          </div>
          {campaign.description && (
            <p className="text-sm text-muted-foreground mt-1">{campaign.description}</p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {campaign.status === "draft" && (
            <button
              type="button"
              onClick={() => setConfirmStartOpen(true)}
              disabled={isActionPending}
              className={cn(buttonVariants({ variant: "default", size: "sm" }), "gap-2")}
            >
              {startMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Start Campaign
            </button>
          )}
          {campaign.status === "active" && (
            <>
              <button
                type="button"
                onClick={() => {
                  sendNowMutation.mutate(undefined, {
                    onSuccess: (r) =>
                      toast.success(`Sent ${r.sent} message${r.sent !== 1 ? "s" : ""}${r.failed ? ` (${r.failed} failed)` : ""}`),
                    onError: () => toast.error("Send Now failed"),
                  });
                }}
                disabled={isActionPending}
                className={cn(buttonVariants({ variant: "default", size: "sm" }), "gap-2")}
              >
                {sendNowMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                Send Now
              </button>
              <button
                type="button"
                onClick={() => {
                  pauseMutation.mutate(campaign.id, {
                    onSuccess: () => toast.success("Campaign paused"),
                    onError: () => toast.error("Failed to pause"),
                  });
                }}
                disabled={isActionPending}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2")}
              >
                {pauseMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pause className="h-3.5 w-3.5" />}
                Pause
              </button>
            </>
          )}
          {campaign.status === "paused" && (
            <button
              type="button"
              onClick={() => {
                resumeMutation.mutate(campaign.id, {
                  onSuccess: () => toast.success("Campaign resumed"),
                  onError: () => toast.error("Failed to resume"),
                });
              }}
              disabled={isActionPending}
              className={cn(buttonVariants({ variant: "default", size: "sm" }), "gap-2")}
            >
              {resumeMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              Resume
            </button>
          )}
          {(campaign.status === "draft" || campaign.status === "paused") && (
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              disabled={deleteMutation.isPending}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-2 text-rose-400 hover:text-rose-400 hover:bg-rose-500/10")}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Stats strip */}
      {campaign.stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Enrolled", value: campaign.stats.total_enrolled },
            { label: "Activated", value: campaign.stats.total_activated },
            { label: "Queued", value: campaign.stats.total_queued },
            { label: "Replied", value: campaign.stats.total_replied },
            { label: "Completed", value: campaign.stats.total_completed },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card px-4 py-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-xl font-bold text-foreground mt-0.5">{s.value.toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="steps">
        <TabsList className="border-b border-border bg-transparent rounded-none gap-1 px-0 h-auto pb-0 mb-5 w-full overflow-x-auto flex-nowrap">
          {[
            { value: "steps", label: "Steps", icon: Settings2 },
            { value: "enroll", label: "Assign Leads", icon: Users },
            { value: "pacing", label: "Pacing", icon: ListFilter },
            { value: "logs", label: "Logs", icon: ScrollText },
            { value: "overview", label: "Overview", icon: Settings2 },
          ].map(({ value, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-muted-foreground data-[state=active]:text-foreground px-4 py-2 text-sm"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Steps tab */}
        <TabsContent value="steps">
          <StepBuilder
            steps={campaign.steps ?? []}
            isEditable={isEditable}
            onAdd={(payload: StepCreatePayload) =>
              addStepMutation.mutate(payload, {
                onError: () => toast.error("Failed to add step"),
              })
            }
            onUpdate={(stepId: string, payload: StepUpdatePayload) =>
              updateStepMutation.mutate(
                { stepId, payload },
                { onError: () => toast.error("Failed to update step") }
              )
            }
            onDelete={(stepId: string) =>
              deleteStepMutation.mutate(stepId, {
                onError: () => toast.error("Failed to delete step"),
              })
            }
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
            clientId={campaign.client_id}
            isPending={
              addStepMutation.isPending ||
              updateStepMutation.isPending ||
              deleteStepMutation.isPending
            }
          />
        </TabsContent>

        {/* Enroll tab */}
        <TabsContent value="enroll">
          <EnrollTab campaign={campaign} />
        </TabsContent>

        {/* Pacing tab */}
        <TabsContent value="pacing">
          <PacingTab campaign={campaign} pacing={pacingStatus} />
        </TabsContent>

        {/* Overview tab */}
        <TabsContent value="overview">
          <OverviewTab campaign={campaign} />
        </TabsContent>

        {/* Logs tab */}
        <TabsContent value="logs">
          <LogsTab campaignId={campaign.id} />
        </TabsContent>
      </Tabs>

      {/* ── Start Campaign confirmation dialog ── */}
      <Dialog open={confirmStartOpen} onOpenChange={setConfirmStartOpen}>
        <DialogContent className="max-w-sm border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-foreground">
              Start Campaign?
            </DialogTitle>
          </DialogHeader>
          {(() => {
            const noSteps = (campaign.steps?.length ?? 0) === 0;
            const noLeads = campaign.total_enrolled === 0;
            const blocked = noSteps || noLeads;
            return (
              <>
                <div className="py-2 space-y-2 text-sm text-muted-foreground">
                  {noSteps && (
                    <p className="text-rose-400 font-medium">No steps defined. Add at least one step before starting.</p>
                  )}
                  {noLeads && (
                    <p className="text-rose-400 font-medium">No leads assigned. Assign leads before starting.</p>
                  )}
                  {!blocked && (
                    <p>
                      You are about to start{" "}
                      <span className="text-foreground font-medium">{campaign.name}</span>.{" "}
                      {campaign.total_enrolled.toLocaleString()} leads will begin receiving messages.
                    </p>
                  )}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setConfirmStartOpen(false)}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    {blocked ? "Close" : "Cancel"}
                  </button>
                  {!blocked && (
                    <button
                      type="button"
                      disabled={startMutation.isPending}
                      onClick={() => {
                        startMutation.mutate(campaign.id, {
                          onSuccess: () => {
                            toast.success("Campaign started");
                            setConfirmStartOpen(false);
                          },
                          onError: () => toast.error("Failed to start campaign"),
                        });
                      }}
                      className={cn(buttonVariants({ variant: "default", size: "sm" }), "gap-2")}
                    >
                      {startMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Confirm & Start
                    </button>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Delete Campaign confirmation dialog ── */}
      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent className="max-w-sm border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-foreground">
              Delete Campaign?
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2 text-sm text-muted-foreground">
            <p>
              You are about to permanently delete{" "}
              <span className="text-foreground font-medium">{campaign.name}</span>.
            </p>
            <p className="text-rose-400 font-medium">
              This cannot be undone. All steps and enrollments will be lost.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(false)}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleteMutation.isPending}
              onClick={handleDelete}
              className={cn(buttonVariants({ variant: "destructive", size: "sm" }), "gap-2")}
            >
              {deleteMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Yes, Delete Campaign
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
