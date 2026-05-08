"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Zap, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  useCampaigns,
  useStartCampaign,
  usePauseCampaign,
  useResumeCampaign,
  useDeleteCampaign,
} from "@/lib/hooks/use-campaigns";
import { CampaignCard } from "./campaign-card";
import { toast } from "sonner";

interface CampaignsListProps {
  clientId: string;
  isOwner: boolean;
}

export function CampaignsList({ clientId, isOwner }: CampaignsListProps) {
  const { data, isLoading } = useCampaigns(clientId);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const startMutation = useStartCampaign(clientId);
  const pauseMutation = usePauseCampaign(clientId);
  const resumeMutation = useResumeCampaign(clientId);
  const deleteMutation = useDeleteCampaign(clientId);

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

  const handleDeleteRequest = (id: string) => {
    const campaign = data?.items.find((c) => c.id === id);
    if (campaign) setDeleteTarget({ id: campaign.id, name: campaign.name });
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success("Campaign deleted");
        setDeleteTarget(null);
      },
      onError: () => {
        toast.error("Failed to delete campaign");
        setDeleteTarget(null);
      },
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
            onDelete={isOwner ? handleDeleteRequest : undefined}
            isPending={pending}
          />
        ))}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-foreground">
              Delete Campaign?
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2 text-sm text-muted-foreground">
            <p>
              You are about to permanently delete{" "}
              <span className="text-foreground font-medium">{deleteTarget?.name}</span>.
            </p>
            <p className="text-rose-400 font-medium">
              This cannot be undone. All steps and enrollments will be lost.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleteMutation.isPending}
              onClick={handleDeleteConfirm}
              className={cn(buttonVariants({ variant: "destructive", size: "sm" }), "gap-2")}
            >
              {deleteMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Yes, Delete
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
