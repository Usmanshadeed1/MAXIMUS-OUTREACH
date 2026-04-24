"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  MapPin,
  Phone,
  Globe,
  Mail,
  Star,
  ExternalLink,
  Tag,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Lead } from "@/types";

const STATUS_STYLES: Record<string, string> = {
  new: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  contacted: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  replied: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  converted: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  opted_out: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  invalid: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
};

const CHANNEL_STYLES: Record<string, string> = {
  email: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  sms: "bg-green-500/10 text-green-400 border-green-500/20",
  whatsapp: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  facebook: "bg-blue-600/10 text-blue-400 border-blue-600/20",
  instagram: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  linkedin: "bg-sky-600/10 text-sky-400 border-sky-600/20",
  youtube: "bg-red-500/10 text-red-400 border-red-500/20",
  twitter: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  tiktok: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  snapchat: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
};

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
        <div className="text-sm text-foreground break-all">{children}</div>
      </div>
    </div>
  );
}

function SocialLink({
  href,
  label,
  color,
}: {
  href: string;
  label: string;
  color: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium",
        "hover:opacity-80 transition-opacity",
        color
      )}
    >
      <ExternalLink className="h-3 w-3" aria-hidden="true" />
      {label}
    </a>
  );
}

interface LeadDetailSheetProps {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
}

export function LeadDetailSheet({ lead, open, onClose }: LeadDetailSheetProps) {
  if (!lead) return null;

  const hasSocials =
    lead.facebook ||
    lead.instagram ||
    lead.linkedin ||
    lead.youtube ||
    lead.twitter ||
    lead.tiktok ||
    lead.snapchat;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[480px] overflow-y-auto border-l border-border bg-card p-0"
      >
        {/* Header */}
        <SheetHeader className="px-6 py-5 border-b border-border">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Building2 className="h-[18px] w-[18px] text-primary" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-base font-semibold text-foreground leading-tight">
                {lead.business_name ?? "Unnamed Lead"}
              </SheetTitle>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                <span
                  className={cn(
                    "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize",
                    STATUS_STYLES[lead.status] ?? "bg-muted text-muted-foreground"
                  )}
                >
                  {lead.status}
                </span>
                {(lead.rating ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-400">
                    <Star className="h-3 w-3 fill-amber-400" aria-hidden="true" />
                    {lead.rating} ({lead.reviews?.toLocaleString() ?? 0})
                  </span>
                )}
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="px-6 py-4 space-y-5">
          {/* Contact info */}
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
              Contact
            </p>
            <div className="rounded-lg border border-border bg-background">
              <div className="px-4">
                {lead.address && (
                  <InfoRow icon={MapPin} label="Address">{lead.address}</InfoRow>
                )}
                {lead.phone && (
                  <InfoRow icon={Phone} label="Phone">
                    <a href={`tel:${lead.phone}`} className="text-primary hover:underline">
                      {lead.phone}
                    </a>
                  </InfoRow>
                )}
                {lead.email && (
                  <InfoRow icon={Mail} label="Email">
                    <a href={`mailto:${lead.email}`} className="text-primary hover:underline">
                      {lead.email}
                    </a>
                  </InfoRow>
                )}
                {lead.website && (
                  <InfoRow icon={Globe} label="Website">
                    <a
                      href={lead.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {lead.website}
                    </a>
                  </InfoRow>
                )}
                {!lead.address && !lead.phone && !lead.email && !lead.website && (
                  <p className="py-3 text-xs text-muted-foreground">No contact info available.</p>
                )}
              </div>
            </div>
          </div>

          {/* Available channels */}
          {lead.available_channels && lead.available_channels.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
                Available Channels
              </p>
              <div className="flex flex-wrap gap-1.5">
                {lead.available_channels.map((ch) => (
                  <span
                    key={ch}
                    className={cn(
                      "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium capitalize",
                      CHANNEL_STYLES[ch] ?? "bg-muted text-muted-foreground border-border"
                    )}
                  >
                    {ch === "social_dm" ? "Social DM" : ch}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Social profiles */}
          {hasSocials && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
                Social Profiles
              </p>
              <div className="flex flex-wrap gap-2">
                {lead.facebook && (
                  <SocialLink href={lead.facebook} label="Facebook" color="bg-blue-600/10 text-blue-400 border-blue-600/20" />
                )}
                {lead.instagram && (
                  <SocialLink href={lead.instagram} label="Instagram" color="bg-pink-500/10 text-pink-400 border-pink-500/20" />
                )}
                {lead.linkedin && (
                  <SocialLink href={lead.linkedin} label="LinkedIn" color="bg-sky-600/10 text-sky-400 border-sky-600/20" />
                )}
                {lead.youtube && (
                  <SocialLink href={lead.youtube} label="YouTube" color="bg-red-500/10 text-red-400 border-red-500/20" />
                )}
                {lead.twitter && (
                  <SocialLink href={lead.twitter} label="Twitter/X" color="bg-zinc-500/10 text-zinc-400 border-zinc-500/20" />
                )}
                {lead.tiktok && (
                  <SocialLink href={lead.tiktok} label="TikTok" color="bg-purple-500/10 text-purple-400 border-purple-500/20" />
                )}
                {lead.snapchat && (
                  <SocialLink href={lead.snapchat} label="Snapchat" color="bg-yellow-500/10 text-yellow-400 border-yellow-500/20" />
                )}
              </div>
            </div>
          )}

          <Separator />

          {/* Tags */}
          {lead.tags && lead.tags.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2 flex items-center gap-1.5">
                <Tag className="h-3 w-3" aria-hidden="true" /> Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {lead.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {lead.notes && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2 flex items-center gap-1.5">
                <FileText className="h-3 w-3" aria-hidden="true" /> Notes
              </p>
              <p className="text-sm text-foreground whitespace-pre-wrap rounded-lg border border-border bg-background px-4 py-3">
                {lead.notes}
              </p>
            </div>
          )}

          {/* Meta */}
          <div className="text-[11px] text-muted-foreground space-y-1 pt-1">
            {lead.source && (
              <p>
                Source:{" "}
                <span className="text-foreground capitalize">{lead.source}</span>
              </p>
            )}
            {lead.imported_at && (
              <p>
                Imported:{" "}
                <span className="text-foreground">
                  {new Date(lead.imported_at).toLocaleDateString()}
                </span>
              </p>
            )}
            {lead.updated_at && (
              <p>
                Updated:{" "}
                <span className="text-foreground">
                  {new Date(lead.updated_at).toLocaleDateString()}
                </span>
              </p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
