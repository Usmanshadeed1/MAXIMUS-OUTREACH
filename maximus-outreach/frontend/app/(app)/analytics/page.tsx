"use client";

import { useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Users,
  Send,
  MessageSquare,
  TrendingUp,
  Download,
  Loader2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePageTitle } from "@/lib/hooks/use-page-title";
import { useDashboardStats, exportAnalytics } from "@/lib/hooks/use-analytics";
import { useClients } from "@/lib/hooks/use-clients";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

const CHART_COLORS = {
  sent:    "hsl(217 91% 60%)",
  replies: "hsl(142 71% 45%)",
  cost:    "hsl(38 92% 50%)",
};

const STATUS_LABELS: Record<string, string> = {
  new:       "New",
  contacted: "Contacted",
  replied:   "Replied",
  qualified: "Qualified",
  customer:  "Customer",
};

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

const CHANNEL_COST_LABEL: Record<string, string> = {
  email:     "$0 / msg",
  sms:       "$0.0079 / msg",
  whatsapp:  "$0.05 / msg",
  social_dm: "Free",
};

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={cn("h-7 w-7 rounded-md flex items-center justify-center", accent ?? "bg-primary/10")}>
          <Icon className={cn("h-4 w-4", accent ? "text-white" : "text-primary")} />
        </div>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg text-xs">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {capitalize(p.name)}: {p.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const defaults = defaultDateRange();
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo,   setDateTo]   = useState(defaults.to);
  const [clientFilter, setClientFilter] = useState("");
  const [exporting, setExporting] = useState(false);
  usePageTitle("Analytics");

  const { data: stats, isLoading, isError } = useDashboardStats({
    client_id: clientFilter || undefined,
    date_from: dateFrom,
    date_to:   dateTo,
  });

  const { data: clientsData } = useClients();
  const clients = clientsData?.items ?? [];

  const handleExport = async () => {
    if (!clientFilter) {
      toast.error("Select a client to export");
      return;
    }
    setExporting(true);
    try {
      await exportAnalytics({
        client_id: clientFilter,
        format: "csv",
        date_from: dateFrom,
        date_to: dateTo,
      });
      toast.success("Export downloaded");
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  // Funnel derived data
  const funnelData = stats?.lead_pipeline ?? [];
  const funnelMax = funnelData[0]?.count || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Performance metrics across all campaigns and channels.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || !clientFilter}
          title={!clientFilter ? "Select a client to export" : "Export CSV"}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/30 transition-colors disabled:opacity-50"
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        {/* Quick ranges */}
        {[
          { label: "7d", days: 7 },
          { label: "30d", days: 30 },
          { label: "90d", days: 90 },
        ].map(({ label, days }) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              const to = new Date();
              const from = new Date();
              from.setDate(from.getDate() - days);
              setDateFrom(from.toISOString().slice(0, 10));
              setDateTo(to.toISOString().slice(0, 10));
            }}
            className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {label}
          </button>
        ))}
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

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((n) => <Skeleton key={n} className="h-28 rounded-xl" />)}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-60 rounded-xl" />
            <Skeleton className="h-60 rounded-xl" />
          </div>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 rounded-xl border border-dashed border-border text-center">
          <p className="text-sm font-medium text-foreground">Failed to load analytics</p>
          <p className="text-xs text-muted-foreground">Check your connection and try again.</p>
        </div>
      ) : !stats ? null : (
        <>
          {/* Stats cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Users}         label="Total Leads"    value={stats.total_leads.toLocaleString()} />
            <StatCard icon={Send}          label="Messages Sent"  value={stats.total_sent.toLocaleString()} />
            <StatCard icon={MessageSquare} label="Replies"        value={stats.total_replies.toLocaleString()} />
            <StatCard
              icon={TrendingUp}
              label="Reply Rate"
              value={`${stats.reply_rate}%`}
              sub={`${stats.conversion_rate}% converted to customer`}
            />
          </div>

          {/* Charts row */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Messages Over Time */}
            <Section title="Messages Over Time">
              {stats.messages_over_time.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No data in range</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={stats.messages_over_time} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradSent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={CHART_COLORS.sent} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={CHART_COLORS.sent} stopOpacity={0}   />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="sent" name="sent" stroke={CHART_COLORS.sent} fill="url(#gradSent)" strokeWidth={2} dot={false} animationDuration={600} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Section>

            {/* Channel Performance */}
            <Section title="Channel Performance">
              {stats.channel_performance.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No data in range</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={stats.channel_performance} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="channel" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={capitalize} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="sent"    name="sent"    fill={CHART_COLORS.sent}    radius={[3, 3, 0, 0]} animationDuration={600} />
                    <Bar dataKey="replies" name="replies" fill={CHART_COLORS.replies} radius={[3, 3, 0, 0]} animationDuration={600} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Section>
          </div>

          {/* Funnel + Cost */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Conversion Funnel */}
            <Section title="Lead Pipeline">
              <div className="space-y-2.5">
                {funnelData.map((step, idx) => {
                  const pct = funnelMax > 0 ? Math.round((step.count / funnelMax) * 100) : 0;
                  const colors = [
                    "bg-blue-500",
                    "bg-indigo-500",
                    "bg-violet-500",
                    "bg-purple-500",
                    "bg-pink-500",
                  ];
                  return (
                    <div key={step.status}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">{STATUS_LABELS[step.status] ?? step.status}</span>
                        <span className="text-xs font-semibold text-foreground">{step.count.toLocaleString()} <span className="text-muted-foreground font-normal">({pct}%)</span></span>
                      </div>
                      <div className="h-2 rounded-full bg-muted/30">
                        <div
                          className={cn("h-2 rounded-full transition-all duration-700", colors[idx] ?? "bg-primary")}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>

            {/* Cost Estimates */}
            <Section title="Cost Estimates">
              <div className="space-y-3">
                {Object.entries(stats.cost_estimates).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No messages sent yet.</p>
                ) : (
                  Object.entries(stats.cost_estimates).map(([ch, cost]) => (
                    <div key={ch} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">{capitalize(ch)}</p>
                        <p className="text-[11px] text-muted-foreground">{CHANNEL_COST_LABEL[ch] ?? "variable"}</p>
                      </div>
                      <p className="text-sm font-semibold text-foreground">
                        {cost === 0 ? <span className="text-green-400">Free</span> : `$${cost.toFixed(4)}`}
                      </p>
                    </div>
                  ))
                )}
                {Object.keys(stats.cost_estimates).length > 0 && (
                  <div className="pt-2 border-t border-border flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground">Total Estimated Cost</p>
                    <p className="text-sm font-bold text-foreground">
                      ${Object.values(stats.cost_estimates).reduce((a, b) => a + b, 0).toFixed(4)}
                    </p>
                  </div>
                )}
              </div>
            </Section>
          </div>

          {/* Top Campaigns Table */}
          <Section title="Top Campaigns">
            {stats.top_campaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No campaign data yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {["Campaign", "Status", "Enrolled", "Sent", "Replies", "Reply Rate"].map((h) => (
                        <th key={h} scope="col" className="text-left text-xs font-medium text-muted-foreground pb-2 pr-4 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.top_campaigns.map((camp) => (
                      <tr key={camp.id} className="border-b border-border/40 hover:bg-muted/10 transition-colors">
                        <td className="py-2.5 pr-4 font-medium text-foreground max-w-[180px] truncate">{camp.name}</td>
                        <td className="py-2.5 pr-4">
                          <span className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border",
                            camp.status === "active"   ? "border-green-500/30 bg-green-500/10 text-green-400"  :
                            camp.status === "paused"   ? "border-amber-500/30 bg-amber-500/10 text-amber-400"  :
                            camp.status === "complete" ? "border-blue-500/30  bg-blue-500/10  text-blue-400"   :
                            "border-border text-muted-foreground"
                          )}>
                            {capitalize(camp.status)}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-muted-foreground">{camp.total_enrolled.toLocaleString()}</td>
                        <td className="py-2.5 pr-4 text-muted-foreground">{camp.sent.toLocaleString()}</td>
                        <td className="py-2.5 pr-4 text-muted-foreground">{camp.replies.toLocaleString()}</td>
                        <td className="py-2.5 pr-4">
                          <span className={cn(
                            "font-semibold",
                            camp.reply_rate >= 20 ? "text-green-400" :
                            camp.reply_rate >= 10 ? "text-amber-400" :
                            "text-muted-foreground"
                          )}>
                            {camp.reply_rate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
