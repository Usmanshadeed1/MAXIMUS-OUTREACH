"use client";

import { useEffect, useState } from "react";
import { Sparkles, Loader2, ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { MessageTemplate } from "@/lib/hooks/use-templates";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClientProfile {
  id: string;
  name: string;
  business_type?: string | null;
  services?: string | null;
  target_audience?: string | null;
  pitch?: string | null;
  tone?: string | null;
  custom_instructions?: string | null;
}

interface TemplateDialogProps {
  open: boolean;
  onClose: () => void;
  client: ClientProfile;
  initial?: MessageTemplate | null;
  onSave: (data: { name: string; subject: string | null; body: string }) => void;
  isSaving?: boolean;
}

// ─── Variable chips ───────────────────────────────────────────────────────────

const VARS = ["{business_name}", "{address}", "{phone}", "{email}", "{website}"];

// ─── Prompt Preview Panel ─────────────────────────────────────────────────────

interface PromptPanelProps {
  client: ClientProfile;
  onGenerated: (text: string) => void;
}

function PromptPanel({ client, onGenerated }: PromptPanelProps) {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Editable prompt fields
  const [clientContext, setClientContext] = useState(() => buildClientContext(client));
  const [messageInstruction, setMessageInstruction] = useState(
    "Write a professional cold outreach email under 200 words. Be personalized, not spammy. Use placeholder variables where relevant."
  );
  const [extraInstruction, setExtraInstruction] = useState("");

  function buildClientContext(c: ClientProfile): string {
    const parts: string[] = [];
    parts.push(`You are an expert outreach copywriter working for "${c.name}".`);
    if (c.business_type) parts.push(`Business type: ${c.business_type}.`);
    if (c.services) parts.push(`Services offered: ${c.services}.`);
    if (c.target_audience) parts.push(`Target audience: ${c.target_audience}.`);
    if (c.pitch) parts.push(`Value proposition: ${c.pitch}.`);
    if (c.tone) parts.push(`Tone: ${c.tone}.`);
    if (c.custom_instructions) parts.push(`Additional instructions: ${c.custom_instructions}`);
    return parts.join("\n");
  }

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const customInstruction = [messageInstruction, extraInstruction].filter(Boolean).join("\n\n")
        + "\n\nWrite a reusable template using these exact placeholder tokens where appropriate: "
        + "{business_name}, {address}, {phone}, {email}, {website}. "
        + "Output ONLY the message text with placeholders. Do NOT fill in real values.";

      const { data } = await api.post<{ template: string }>(
        `/clients/${client.id}/ai/draft-template`,
        { channel: "email", custom_instruction: customInstruction }
      );
      onGenerated(data.template);
      setOpen(false);
      toast.success("Message generated — review and edit before saving");
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(detail ?? "AI generation failed — check AI keys in Settings");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5">
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-primary"
      >
        <span className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5" />
          Generate with AI
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-primary/20 pt-4">
          {/* Client context */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Client Context
              <span className="ml-1.5 text-muted-foreground/60 font-normal">
                (auto-filled from client profile — edit if needed)
              </span>
            </label>
            <textarea
              rows={5}
              value={clientContext}
              onChange={(e) => setClientContext(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none font-mono"
            />
          </div>

          {/* Message instruction */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Message Instruction
              <span className="ml-1.5 text-muted-foreground/60 font-normal">
                (what the AI should write)
              </span>
            </label>
            <textarea
              rows={3}
              value={messageInstruction}
              onChange={(e) => setMessageInstruction(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>

          {/* Extra instruction */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Extra Instruction <span className="text-muted-foreground/60 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={extraInstruction}
              onChange={(e) => setExtraInstruction(e.target.value)}
              placeholder="e.g. keep it under 80 words, always mention free estimate"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className={cn(
              buttonVariants({ variant: "default", size: "sm" }),
              "w-full justify-center gap-2"
            )}
          >
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {generating ? "Generating…" : "Generate Message"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Dialog ──────────────────────────────────────────────────────────────

export function TemplateDialog({
  open,
  onClose,
  client,
  initial,
  onSave,
  isSaving = false,
}: TemplateDialogProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setSubject(initial?.subject ?? "");
      setBody(initial?.body ?? "");
      setShowPreview(false);
    }
  }, [open, initial]);

  const insertVar = (v: string) => setBody((b) => b + v);

  const previewBody = body
    .replace("{business_name}", "Johnson's Kitchen Co.")
    .replace("{address}", "123 Main St, New York")
    .replace("{phone}", "(212) 555-0198")
    .replace("{email}", "info@johnsonskitchen.com")
    .replace("{website}", "www.johnsonskitchen.com");

  const handleSave = () => {
    if (!name.trim()) { toast.error("Template name is required"); return; }
    if (!body.trim()) { toast.error("Message body is required"); return; }
    onSave({ name: name.trim(), subject: subject.trim() || null, body: body.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl w-full border-border bg-card p-0 gap-0 max-h-[90vh] flex flex-col">
        <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
          <DialogTitle className="text-base font-semibold text-foreground">
            {initial ? "Edit Template" : "New Template"}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Template Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Cold Email — Free Estimate Offer"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Subject Line <span className="text-muted-foreground/60 font-normal">(optional — for emails)</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Quick question about {business_name}"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Body */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-muted-foreground">
                Message Body *
              </label>
              {body && (
                <button
                  type="button"
                  onClick={() => setShowPreview((p) => !p)}
                  className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  {showPreview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {showPreview ? "Edit" : "Preview"}
                </button>
              )}
            </div>

            {showPreview ? (
              <div className="rounded-md border border-border bg-muted/20 px-4 py-3 text-sm text-foreground whitespace-pre-wrap min-h-[140px]">
                {previewBody}
                <p className="mt-3 pt-3 border-t border-border text-[10px] text-muted-foreground">
                  Previewed with sample lead: <strong>Johnson's Kitchen Co.</strong>
                </p>
              </div>
            ) : (
              <textarea
                rows={7}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your message template here, or use Generate with AI below…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            )}

            {/* Variable chips */}
            {!showPreview && (
              <div className="mt-2">
                <p className="text-[10px] text-muted-foreground mb-1.5">Insert variable:</p>
                <div className="flex flex-wrap gap-1.5">
                  {VARS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => insertVar(v)}
                      className="rounded border border-border bg-muted/30 px-2 py-0.5 text-[11px] text-foreground hover:bg-primary/10 hover:border-primary/40 transition-colors"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* AI Prompt Panel */}
          {!showPreview && (
            <PromptPanel client={client} onGenerated={(text) => setBody(text)} />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !name.trim() || !body.trim()}
            className={cn(buttonVariants({ variant: "default", size: "sm" }), "gap-2 min-w-[100px]")}
          >
            {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {initial ? "Save Changes" : "Save Template"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
