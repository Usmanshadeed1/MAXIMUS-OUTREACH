"use client";

import { cn } from "@/lib/utils";

// ─── Timezone list ────────────────────────────────────────────────────────────

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "UTC",
];

// ─── Pacing modes ─────────────────────────────────────────────────────────────

const PACING_MODES = [
  { value: "all_at_once", label: "All at once", description: "Activate all leads immediately" },
  { value: "fixed_daily", label: "Fixed daily", description: "Fixed number of leads per day" },
  { value: "gradual_rampup", label: "Gradual ramp-up", description: "Start slow, increase each week" },
  { value: "custom", label: "Custom schedule", description: "Set per-week targets manually" },
] as const;

// ─── Estimate helper ──────────────────────────────────────────────────────────

function estimateDays(
  totalLeads: number,
  mode: string,
  config: Record<string, number>
): string {
  if (!totalLeads || totalLeads <= 0) return "";
  if (mode === "all_at_once") return "All leads activated on day 1";

  const avg = Object.values(config).reduce((s, v) => s + v, 0) /
    Math.max(1, Object.values(config).length);
  if (!avg) return "";

  const days = Math.ceil(totalLeads / avg);
  if (days <= 7) return `~${days} days at this pace`;
  const weeks = Math.ceil(days / 7);
  return `~${weeks} week${weeks !== 1 ? "s" : ""} at this pace`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PacingConfigValue {
  pacing_mode: string;
  pacing_leads_per_day: Record<string, number>;
  send_window_start: string;
  send_window_end: string;
  send_timezone: string;
}

interface PacingConfigProps {
  value: PacingConfigValue;
  onChange: (v: PacingConfigValue) => void;
  totalLeads?: number;
  totalActivated?: number;
  disabled?: boolean;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-muted-foreground mb-1.5">{children}</label>
  );
}

function NumberInput({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type="number"
      min={1}
      value={value || ""}
      onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
    />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PacingConfig({
  value,
  onChange,
  totalLeads = 0,
  totalActivated = 0,
  disabled = false,
}: PacingConfigProps) {
  const { pacing_mode, pacing_leads_per_day, send_window_start, send_window_end, send_timezone } = value;

  const set = (patch: Partial<PacingConfigValue>) =>
    onChange({ ...value, ...patch });

  const setLeadsPerDay = (patch: Record<string, number>) =>
    set({ pacing_leads_per_day: { ...pacing_leads_per_day, ...patch } });

  const estimate = estimateDays(totalLeads, pacing_mode, pacing_leads_per_day);
  const activationPct =
    totalLeads > 0 ? Math.min(100, Math.round((totalActivated / totalLeads) * 100)) : 0;

  return (
    <div className="space-y-5">
      {/* ── Mode selector ── */}
      <div>
        <FieldLabel>Pacing Mode</FieldLabel>
        <div className="grid grid-cols-2 gap-2">
          {PACING_MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              disabled={disabled}
              onClick={() => set({ pacing_mode: mode.value })}
              className={cn(
                "flex flex-col items-start rounded-lg border px-4 py-3 text-left transition-colors",
                pacing_mode === mode.value
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border hover:border-primary/40 text-muted-foreground"
              )}
            >
              <span className="text-sm font-medium text-foreground">{mode.label}</span>
              <span className="text-[11px] text-muted-foreground mt-0.5">{mode.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Mode-specific inputs ── */}
      {pacing_mode === "fixed_daily" && (
        <div className="max-w-[200px]">
          <FieldLabel>Leads per day</FieldLabel>
          <NumberInput
            value={pacing_leads_per_day.daily ?? 50}
            onChange={(v) => setLeadsPerDay({ daily: v })}
            placeholder="50"
            disabled={disabled}
          />
        </div>
      )}

      {pacing_mode === "gradual_rampup" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(["week1", "week2", "week3", "week4_plus"] as const).map((key, i) => (
            <div key={key}>
              <FieldLabel>Week {i < 3 ? i + 1 : "4+"} / day</FieldLabel>
              <NumberInput
                value={pacing_leads_per_day[key] ?? 0}
                onChange={(v) => setLeadsPerDay({ [key]: v })}
                placeholder={String(50 * (i + 1))}
                disabled={disabled}
              />
            </div>
          ))}
        </div>
      )}

      {pacing_mode === "custom" && (
        <div className="space-y-2">
          <FieldLabel>Custom schedule (week → leads/day)</FieldLabel>
          {Object.entries(pacing_leads_per_day)
            .filter(([k]) => k.startsWith("week"))
            .map(([key, val]) => (
              <div key={key} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-16 shrink-0 capitalize">
                  {key.replace("_", " ")}
                </span>
                <NumberInput
                  value={val}
                  onChange={(v) => setLeadsPerDay({ [key]: v })}
                  disabled={disabled}
                />
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = { ...pacing_leads_per_day };
                      delete next[key];
                      set({ pacing_leads_per_day: next });
                    }}
                    className="text-muted-foreground hover:text-rose-400 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          {!disabled && (
            <button
              type="button"
              onClick={() => {
                const existing = Object.keys(pacing_leads_per_day).filter((k) =>
                  k.startsWith("week")
                );
                const nextNum = existing.length + 1;
                setLeadsPerDay({ [`week${nextNum}`]: 100 });
              }}
              className="text-xs text-primary hover:underline"
            >
              + Add week
            </button>
          )}
        </div>
      )}

      {/* ── Estimate + progress ── */}
      {estimate && (
        <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            <span className="text-foreground font-medium">{totalLeads.toLocaleString()} leads</span>{" "}
            → {estimate}
          </p>
          {totalLeads > 0 && totalActivated > 0 && (
            <div>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-muted-foreground">
                  {totalActivated.toLocaleString()} of {totalLeads.toLocaleString()} activated
                </span>
                <span className="text-foreground font-medium">{activationPct}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${activationPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Send window ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <FieldLabel>Window Start</FieldLabel>
          <input
            type="time"
            value={send_window_start}
            onChange={(e) => set({ send_window_start: e.target.value })}
            disabled={disabled}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
          />
        </div>
        <div>
          <FieldLabel>Window End</FieldLabel>
          <input
            type="time"
            value={send_window_end}
            onChange={(e) => set({ send_window_end: e.target.value })}
            disabled={disabled}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
          />
        </div>
        <div>
          <FieldLabel>Timezone</FieldLabel>
          <select
            value={send_timezone}
            onChange={(e) => set({ send_timezone: e.target.value })}
            disabled={disabled}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
