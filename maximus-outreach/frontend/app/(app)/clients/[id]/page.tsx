"use client";

import { use, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Building2,
  Pencil,
  ChevronLeft,
  Users,
  Zap,
  MessageSquare,
  TrendingUp,
  Globe,
  Phone,
  Mail,
  Mic2,
  BookOpen,
  Target,
  FileText,
  ToggleLeft,
  ToggleRight,
  Upload,
  Plus,
  Download,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useClient } from "@/lib/hooks/use-clients";
import { useClientAnalytics, useDashboardStats, exportAnalytics } from "@/lib/hooks/use-analytics";
import { useAuth } from "@/contexts/auth-context";
import { useCampaigns } from "@/lib/hooks/use-campaigns";
import { LeadsTable } from "@/components/leads/leads-table";
import { CsvImportModal } from "@/components/leads/csv-import-modal";
import { ImportHistory } from "@/components/leads/import-history";
import { CampaignsList } from "@/components/campaigns/campaigns-list";
import { usePageTitle } from "@/lib/hooks/use-page-title";

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "primary",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: "primary" | "emerald" | "amber" | "rose";
}) {
  const colors = {
    primary: "bg-primary/10 border-primary/20 text-primary",
    emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    amber: "bg-amber-500/10 border-amber-500/20 text-amber-400",
    rose: "bg-rose-500/10 border-rose-500/20 text-rose-400",
  };
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex items-start gap-4">
      <div
        className={cn(
          "h-10 w-10 rounded-lg border flex items-center justify-center shrink-0",
          colors[color]
        )}
      >
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Info row ─────────────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" aria-hidden="true" />
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</span>
        <span className="text-sm text-foreground break-all">{value}</span>
      </div>
    </div>
  );
}

// ─── Channel pill ─────────────────────────────────────────────────────────────

const CHANNEL_STYLES: Record<string, string> = {
  email: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  sms: "bg-green-500/10 text-green-400 border-green-500/20",
  whatsapp: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  social_dm: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

function channelLabel(ch: string) {
  return ch === "social_dm" ? "Social DM" : ch.charAt(0).toUpperCase() + ch.slice(1);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const { isOwner } = useAuth();
  const [importOpen, setImportOpen] = useState(false);
  usePageTitle("Client");
  usePageTitle("Client");

  // Analytics date range
  const today = new Date().toISOString().slice(0, 10);
  const thirtyAgo = (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); })();
  const [dateFrom, setDateFrom] = useState(thirtyAgo);
  const [dateTo,   setDateTo]   = useState(today);
  const [exporting, setExporting] = useState(false);

  const { data: client, isLoading: clientLoading, error: clientError } = useClient(id);
  const { data: analytics, isLoading: analyticsLoading } = useClientAnalytics(id);
  const { data: campaignsData } = useCampaigns(id);
  const hasCampaigns = (campaignsData?.items?.length ?? 0) > 0;
  const { data: fullStats, isLoading: fullStatsLoading } = useDashboardStats({
    client_id: id,
    date_from: dateFrom,
    date_to:   dateTo,
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportAnalytics({ client_id: id, format: "csv", date_from: dateFrom, date_to: dateTo });
      toast.success("Export downloaded");
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  // ── Loading skeleton ──
  if (clientLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 pb-10">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-48 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  // ── 404 / 403 ──
  if (clientError || !client) {
    return (
      <div className="max-w-5xl mx-auto flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-muted-foreground text-sm">
          {(clientError as { response?: { status?: number } })?.response?.status === 403
            ? "You don't have access to this client."
            : "Client not found."}
        </p>
        <Link
          href="/clients"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Back to Clients
        </Link>
      </div>
    );
  }

  const totalSent = analytics?.total_sent ?? 0;
  const replyRate = analytics?.reply_rate ?? 0;
  const channelPerf = analytics?.channel_performance ?? [];
  const tabParam = searchParams.get("tab");
  const initialTab =
    tabParam === "overview" ||
    tabParam === "leads" ||
    tabParam === "campaigns" ||
    tabParam === "analytics"
      ? tabParam
      : "overview";

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">
      {/* ── Breadcrumb + header ── */}
      <div>
        <Link
          href="/clients"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "gap-1.5 -ml-2 mb-3 text-muted-foreground"
          )}
        >
          <ChevronLeft className="h-4 w-4" />
          Clients
        </Link>

        <div className="flex flex-wrap items-start gap-3 justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-foreground truncate">
                  {client.name}
                </h1>
                <Badge
                  variant={client.is_active ? "default" : "secondary"}
                  className="shrink-0 text-xs"
                >
                  {client.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
              {client.business_type && (
                <p className="text-sm text-muted-foreground mt-0.5">{client.business_type}</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {isOwner && (
              <>
                <Link
                  href={`/clients/${client.id}/edit`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2")}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Link>
                <button
                  onClick={() => setImportOpen(true)}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2")}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Import Leads
                </button>
                <Link
                  href={`/campaigns/new?client_id=${client.id}`}
                  className={cn(buttonVariants({ variant: "default", size: "sm" }), "gap-2")}
                >
                  <Plus className="h-3.5 w-3.5" />
                  New Campaign
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Total Leads"
          value={client.lead_count?.toLocaleString() ?? "0"}
          color="primary"
        />
        <StatCard
          icon={Zap}
          label="Active Campaigns"
          value={client.active_campaigns_count ?? 0}
          color="amber"
        />
        <StatCard
          icon={MessageSquare}
          label="Messages Sent"
          value={analyticsLoading ? "—" : totalSent.toLocaleString()}
          color="emerald"
        />
        <StatCard
          icon={TrendingUp}
          label="Reply Rate"
          value={analyticsLoading ? "—" : `${replyRate}%`}
          sub={
            !analyticsLoading && analytics
              ? `${analytics.total_replies.toLocaleString()} replies`
              : undefined
          }
          color="rose"
        />
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue={initialTab}>
        <TabsList className="mb-5 w-full overflow-x-auto flex-nowrap justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* ──────────── Overview ──────────── */}
        <TabsContent value="overview" className="space-y-5 mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* ── Client Details card ── */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border">
                <h2 className="text-sm font-semibold text-foreground">Client Details</h2>
              </div>
              <div className="px-5 py-2">
                {client.website && (
                  <InfoRow
                    icon={Globe}
                    label="Website"
                    value={
                      <a
                        href={client.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {client.website}
                      </a>
                    }
                  />
                )}
                {client.phone && (
                  <InfoRow icon={Phone} label="Phone" value={client.phone} />
                )}
                <InfoRow
                  icon={Mic2}
                  label="Outreach Tone"
                  value={
                    <span className="capitalize">{client.tone ?? "professional"}</span>
                  }
                />
                <InfoRow
                  icon={client.is_active ? ToggleRight : ToggleLeft}
                  label="Status"
                  value={
                    <Badge
                      variant={client.is_active ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {client.is_active ? "Active" : "Inactive"}
                    </Badge>
                  }
                />
              </div>
            </div>

            {/* ── AI Configuration card ── */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border">
                <h2 className="text-sm font-semibold text-foreground">AI Configuration</h2>
              </div>
              <div className="px-5 py-2">
                {client.services && (
                  <InfoRow icon={BookOpen} label="Services" value={client.services} />
                )}
                {client.target_audience && (
                  <InfoRow
                    icon={Target}
                    label="Target Audience"
                    value={client.target_audience}
                  />
                )}
                {client.pitch && (
                  <InfoRow icon={Zap} label="Value Pitch" value={client.pitch} />
                )}
                {client.custom_instructions && (
                  <InfoRow
                    icon={FileText}
                    label="Custom Instructions"
                    value={client.custom_instructions}
                  />
                )}
                {!client.services &&
                  !client.target_audience &&
                  !client.pitch &&
                  !client.custom_instructions && (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No AI configuration set.{" "}
                      {isOwner && (
                        <Link
                          href={`/clients/${client.id}/edit`}
                          className="text-primary hover:underline"
                        >
                          Edit client
                        </Link>
                      )}{" "}
                      to add it.
                    </p>
                  )}
              </div>
            </div>
          </div>

          {/* ── Channel Performance ── */}
          {!analyticsLoading && channelPerf.length > 0 && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border">
                <h2 className="text-sm font-semibold text-foreground">Channel Performance</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th scope="col" className="px-5 py-3 text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                        Channel
                      </th>
                      <th scope="col" className="px-5 py-3 text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                        Sent
                      </th>
                      <th scope="col" className="px-5 py-3 text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                        Replies
                      </th>
                      <th scope="col" className="px-5 py-3 text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                        Reply Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {channelPerf.map((ch) => (
                      <tr
                        key={ch.channel}
                        className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                      >
                        <td className="px-5 py-3.5">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
                              CHANNEL_STYLES[ch.channel] ?? "bg-muted text-muted-foreground border-border"
                            )}
                          >
                            {channelLabel(ch.channel)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right tabular-nums text-foreground">
                          {ch.sent.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 text-right tabular-nums text-foreground">
                          {ch.replies.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 text-right tabular-nums">
                          <span
                            className={cn(
                              "font-medium",
                              ch.reply_rate >= 10
                                ? "text-emerald-400"
                                : ch.reply_rate >= 5
                                ? "text-amber-400"
                                : "text-muted-foreground"
                            )}
                          >
                            {ch.reply_rate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Channel perf empty state */}
          {!analyticsLoading && channelPerf.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <MessageSquare
                className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3"
                aria-hidden="true"
              />
              {hasCampaigns ? (
                <>
                  <p className="text-sm font-medium text-foreground">No outreach data yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your campaigns haven't sent any messages yet. Start or activate a campaign to see data here.
                  </p>
                  <Link
                    href={`/clients/${client.id}?tab=campaigns`}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "mt-4 gap-2"
                    )}
                  >
                    <Zap className="h-3.5 w-3.5" />
                    View Campaigns
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-foreground">No outreach data yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Create your first campaign to start sending outreach.
                  </p>
                  <Link
                    href={`/campaigns/new?client_id=${client.id}`}
                    className={cn(
                      buttonVariants({ variant: "default", size: "sm" }),
                      "mt-4 gap-2"
                    )}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create First Campaign
                  </Link>
                </>
              )}
            </div>
          )}
        </TabsContent>

        {/* ──────────── Leads ──────────── */}
        <TabsContent value="leads" className="mt-0 space-y-5">
          <LeadsTable clientId={client.id} isOwner={isOwner} />
          <ImportHistory clientId={client.id} />
        </TabsContent>

        {/* ──────────── Campaigns ──────────── */}
        <TabsContent value="campaigns" className="mt-0">
          <CampaignsList clientId={client.id} isOwner={isOwner} />
        </TabsContent>

        {/* ──────────── Analytics ──────────── */}
        <TabsContent value="analytics" className="mt-0 space-y-6">
          {/* Filter bar */}
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">From</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">To</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>
              {[{ label: "7d", days: 7 }, { label: "30d", days: 30 }, { label: "90d", days: 90 }].map(({ label, days }) => (
                <button key={label} type="button"
                  onClick={() => {
                    const to = new Date(); const from = new Date();
                    from.setDate(from.getDate() - days);
                    setDateFrom(from.toISOString().slice(0, 10));
                    setDateTo(to.toISOString().slice(0, 10));
                  }}
                  className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  {label}
                </button>
              ))}
            </div>
            <button type="button" onClick={handleExport} disabled={exporting}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/30 transition-colors disabled:opacity-50">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export CSV
            </button>
          </div>

          {fullStatsLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1,2,3,4].map(n => <Skeleton key={n} className="h-28 rounded-xl" />)}
            </div>
          ) : !fullStats ? null : (
            <>
              {/* Stat cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {([
                  { label: "Total Leads",   value: fullStats.total_leads.toLocaleString()  },
                  { label: "Messages Sent", value: fullStats.total_sent.toLocaleString()   },
                  { label: "Replies",       value: fullStats.total_replies.toLocaleString() },
                  { label: "Reply Rate",    value: `${fullStats.reply_rate}%`,
                    sub: `${fullStats.conversion_rate}% conversion` },
                ] as { label: string; value: string; sub?: string }[]).map(({ label, value, sub }) => (
                  <div key={label} className="rounded-xl border border-border bg-card px-5 py-4">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
                    {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
                  </div>
                ))}
              </div>

              {/* Charts row */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Messages Over Time */}
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="px-5 py-3 border-b border-border"><h3 className="text-sm font-semibold text-foreground">Messages Over Time</h3></div>
                  <div className="p-5">
                    {fullStats.messages_over_time.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-8 text-center">No data in range</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={fullStats.messages_over_time} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="cGradSent" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="hsl(217 91% 60%)" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="hsl(217 91% 60%)" stopOpacity={0}   />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                          <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                          <Area type="monotone" dataKey="sent" stroke="hsl(217 91% 60%)" fill="url(#cGradSent)" strokeWidth={2} dot={false} animationDuration={600} />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Channel Performance */}
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="px-5 py-3 border-b border-border"><h3 className="text-sm font-semibold text-foreground">Channel Performance</h3></div>
                  <div className="p-5">
                    {fullStats.channel_performance.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-8 text-center">No data in range</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={fullStats.channel_performance} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="channel" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={(v) => v.charAt(0).toUpperCase() + v.slice(1)} />
                          <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                          <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Bar dataKey="sent"    fill="hsl(217 91% 60%)" radius={[3,3,0,0]} animationDuration={600} />
                          <Bar dataKey="replies" fill="hsl(142 71% 45%)" radius={[3,3,0,0]} animationDuration={600} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>

              {/* Lead Pipeline */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-5 py-3 border-b border-border"><h3 className="text-sm font-semibold text-foreground">Lead Pipeline</h3></div>
                <div className="p-5 space-y-2.5">
                  {fullStats.lead_pipeline.map((step, idx) => {
                    const max = fullStats.lead_pipeline[0]?.count || 1;
                    const pct = Math.round((step.count / max) * 100);
                    const bars = ["bg-blue-500","bg-indigo-500","bg-violet-500","bg-purple-500","bg-pink-500"];
                    const labels: Record<string,string> = { new:"New", contacted:"Contacted", replied:"Replied", qualified:"Qualified", customer:"Customer" };
                    return (
                      <div key={step.status}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">{labels[step.status] ?? step.status}</span>
                          <span className="text-xs font-semibold text-foreground">{step.count.toLocaleString()} <span className="text-muted-foreground font-normal">({pct}%)</span></span>
                        </div>
                        <div className="h-2 rounded-full bg-muted/30">
                          <div className={cn("h-2 rounded-full transition-all duration-700", bars[idx] ?? "bg-primary")} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Per-campaign breakdown */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-5 py-3 border-b border-border"><h3 className="text-sm font-semibold text-foreground">Campaign Breakdown</h3></div>
                {fullStats.top_campaigns.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-5">No campaign data yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          {["Campaign","Status","Enrolled","Activated","Sent","Replies","Reply Rate"].map(h => (
                            <th key={h} scope="col" className="text-left text-xs font-medium text-muted-foreground px-5 py-3 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {fullStats.top_campaigns.map(camp => (
                          <tr key={camp.id} className="border-b border-border/40 hover:bg-muted/10 transition-colors">
                            <td className="px-5 py-3 font-medium text-foreground max-w-[160px] truncate">{camp.name}</td>
                            <td className="px-5 py-3">
                              <span className={cn(
                                "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border",
                                camp.status === "active"   ? "border-green-500/30 bg-green-500/10 text-green-400" :
                                camp.status === "paused"   ? "border-amber-500/30 bg-amber-500/10 text-amber-400" :
                                camp.status === "complete" ? "border-blue-500/30  bg-blue-500/10  text-blue-400"  :
                                "border-border text-muted-foreground"
                              )}>{camp.status.charAt(0).toUpperCase() + camp.status.slice(1)}</span>
                            </td>
                            <td className="px-5 py-3 text-muted-foreground tabular-nums">{camp.total_enrolled.toLocaleString()}</td>
                            <td className="px-5 py-3 text-muted-foreground tabular-nums">{camp.total_activated?.toLocaleString() ?? "—"}</td>
                            <td className="px-5 py-3 text-muted-foreground tabular-nums">{camp.sent.toLocaleString()}</td>
                            <td className="px-5 py-3 text-muted-foreground tabular-nums">{camp.replies.toLocaleString()}</td>
                            <td className="px-5 py-3">
                              <span className={cn("font-semibold",
                                camp.reply_rate >= 20 ? "text-green-400" :
                                camp.reply_rate >= 10 ? "text-amber-400" :
                                "text-muted-foreground"
                              )}>{camp.reply_rate}%</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Cost Estimates */}
              {Object.keys(fullStats.cost_estimates).length > 0 && (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="px-5 py-3 border-b border-border"><h3 className="text-sm font-semibold text-foreground">Cost Estimates</h3></div>
                  <div className="p-5 space-y-3">
                    {Object.entries(fullStats.cost_estimates).map(([ch, cost]) => (
                      <div key={ch} className="flex items-center justify-between">
                        <p className="text-sm text-foreground capitalize">{ch.replace(/_/g, " ")}</p>
                        <p className="text-sm font-semibold">{cost === 0 ? <span className="text-green-400">Free</span> : `$${cost.toFixed(4)}`}</p>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-border flex items-center justify-between">
                      <p className="text-xs font-semibold text-muted-foreground">Total Estimated Cost</p>
                      <p className="text-sm font-bold text-foreground">${Object.values(fullStats.cost_estimates).reduce((a,b)=>a+b,0).toFixed(4)}</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* ── CSV Import Modal ── */}
      <CsvImportModal
        clientId={client.id}
        open={importOpen}
        onClose={() => setImportOpen(false)}
      />
    </div>
  );
}
