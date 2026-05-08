"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCreateCampaign } from "@/lib/hooks/use-campaigns";
import { useClient } from "@/lib/hooks/use-clients";
import { PacingConfig, type PacingConfigValue } from "@/components/campaigns/pacing-config";
import { toast } from "sonner";
import { usePageTitle } from "@/lib/hooks/use-page-title";

const DEFAULT_PACING: PacingConfigValue = {
  pacing_mode: "gradual_rampup",
  pacing_leads_per_day: { week1: 50, week2: 100, week3: 150, week4_plus: 200 },
  send_window_start: "09:00",
  send_window_end: "18:00",
  send_timezone: "America/New_York",
};

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="px-5 py-5">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
      {children}
    </div>
  );
}

export default function NewCampaignPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = searchParams.get("client_id") ?? "";
  usePageTitle("New Campaign");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [stopOnReply, setStopOnReply] = useState(true);
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [repeatDelay, setRepeatDelay] = useState(14);
  const [pacing, setPacing] = useState<PacingConfigValue>(DEFAULT_PACING);

  const createMutation = useCreateCampaign(clientId);
  const { data: client } = useClient(clientId);
  const isRepeatDelayApplicable = maxAttempts > 1;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Campaign name is required");
      return;
    }
    if (!clientId) {
      toast.error("No client selected");
      return;
    }

    createMutation.mutate(
      {
        name: name.trim(),
        description: description.trim() || undefined,
        stop_on_reply: stopOnReply,
        max_attempts: maxAttempts,
        repeat_delay_days: repeatDelay,
        ...pacing,
      },
      {
        onSuccess: (campaign) => {
          toast.success("Campaign created");
          router.push(`/campaigns/${campaign.id}`);
        },
        onError: (e: unknown) =>
          toast.error(
            (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
            "Failed to create campaign"
          ),
      }
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">
      {/* Header */}
      <div>
        <Link
          href={clientId ? `/clients/${clientId}` : "/clients"}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "gap-1.5 -ml-2 mb-3 text-muted-foreground"
          )}
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Client
        </Link>
        <h1 className="text-2xl font-bold text-foreground">
          New Campaign{client ? ` for ${client.name}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Configure your outreach campaign settings.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* ── Basic settings ── */}
        <SectionCard title="Campaign Settings">
          <div className="space-y-4">
            <Field label="Campaign Name *">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Kitchen Remodel Outreach Q2"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </Field>
            <Field label="Description">
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Max Attempts per Lead">
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(parseInt(e.target.value, 10) || 1)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </Field>
              {isRepeatDelayApplicable ? (
                <Field label="Repeat Delay (days)">
                  <div className="space-y-1.5">
                    <input
                      type="number"
                      min={1}
                      value={repeatDelay}
                      onChange={(e) => setRepeatDelay(parseInt(e.target.value, 10) || 14)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Used before the next attempt cycle starts.
                    </p>
                  </div>
                </Field>
              ) : (
                <Field label="Repeat Cycle">
                  <div className="rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                    No repeat cycle when max attempts is 1.
                  </div>
                </Field>
              )}
              <Field label="Stop on Reply">
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={stopOnReply}
                    onClick={() => setStopOnReply((v) => !v)}
                    className={cn(
                      "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                      stopOnReply ? "bg-primary" : "bg-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                        stopOnReply ? "translate-x-4" : "translate-x-0"
                      )}
                    />
                  </button>
                  <span className="text-sm text-foreground">{stopOnReply ? "Yes" : "No"}</span>
                </div>
              </Field>
            </div>
          </div>
        </SectionCard>

        {/* ── Pacing ── */}
        <SectionCard title="Pacing Configuration">
          <PacingConfig value={pacing} onChange={setPacing} />
        </SectionCard>

        {/* ── Footer actions ── */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href={clientId ? `/clients/${clientId}` : "/clients"}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={createMutation.isPending || !name.trim()}
            className={cn(buttonVariants({ variant: "default", size: "sm" }), "gap-2 min-w-[140px]")}
          >
            {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Create Campaign
          </button>
        </div>
      </form>
    </div>
  );
}
