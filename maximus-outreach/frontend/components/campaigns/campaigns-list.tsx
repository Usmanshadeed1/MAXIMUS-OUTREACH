"use client";

import Link from "next/link";
import { Plus, Zap, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useCampaigns,
  useStartCampaign,
  usePauseCampaign,
  useResumeCampaign,
} from "@/lib/hooks/use-campaigns";
import { CampaignCard } from "./campaign-card";
import { toast } from "sonner";

interface CampaignsListProps {
  clientId: string;
  isOwner: boolean;
}

export function CampaignsList({ clientId, isOwner }: CampaignsListProps) {
  const { data, isLoading } = useCampaigns(clientId);

  const startMutation = useStartCampaign(clientId);
  const pauseMutation = usePauseCampaign(clientId);
  const resumeMutation = useResumeCampaign(clientId);

  const pending = startMutation.isPending || pauseMutation.isPending || resumeMutation.isPending;

  const handleStart = (id: string) => {
    startMutation.mutate(id, {
      onSuccess: () => toast.success("Campaign started"),
      onError: (e: unknown) =>
        toast.error(
          (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          "Failed to start campaign"
        ),
    });
  };

  const handlePause = (id: string) => {
    pauseMutation.mutate(id, {
      onSuccess: () => toast.success("Campaign paused"),
      onError: (e: unknown) =>
        toast.error(
          (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          "Failed to pause campaign"
        ),
    });
  };

  const handleResume = (id: string) => {
    resumeMutation.mutate(id, {
      onSuccess: () => toast.success("Campaign resumed"),
      onError: (e: unknown) =>
        toast.error(
          (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          "Failed to resume campaign"
        ),
    });
  };

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const campaigns = data?.items ?? [];

  // ── Empty ──
  if (campaigns.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 text-center space-y-3">
        <Zap className="h-10 w-10 text-muted-foreground/30 mx-auto" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">No campaigns yet</p>
        <p className="text-xs text-muted-foreground max-w-xs mx-auto">
          Create a campaign to start sending outreach to your leads.
        </p>
        <Link
          href={`/campaigns/new?client_id=${clientId}`}
          className={cn(buttonVariants({ variant: "default", size: "sm" }), "mt-2 gap-2")}
        >
          <Plus className="h-3.5 w-3.5" />
          New Campaign
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {data?.total ?? campaigns.length} campaign{(data?.total ?? campaigns.length) !== 1 ? "s" : ""}
        </p>
        {isOwner && (
          <Link
            href={`/campaigns/new?client_id=${clientId}`}
            className={cn(buttonVariants({ variant: "default", size: "sm" }), "gap-2")}
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            New Campaign
          </Link>
        )}
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {campaigns.map((campaign) => (
          <CampaignCard
            key={campaign.id}
            campaign={campaign}
            onStart={isOwner ? handleStart : undefined}
            onPause={isOwner ? handlePause : undefined}
            onResume={isOwner ? handleResume : undefined}
            isPending={pending}
          />
        ))}
      </div>
    </div>
  );
}
