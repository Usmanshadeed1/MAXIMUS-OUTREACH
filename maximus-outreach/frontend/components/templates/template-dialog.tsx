"use client";

import { useEffect, useState } from "react";
import { Sparkles, Loader2, ChevronDown, ChevronUp, Eye, EyeOff, Globe, BookmarkPlus } from "lucide-react";
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

export interface ClientProfile {
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
  // client is optional — when absent (global template), AI panel shows manual prompt only
  client?: ClientProfile | null;
  initial?: MessageTemplate | null;
  // library mode: single Save button
  onSave?: (data: { name: string; subject: string | null; body: string }) => void;
  isSaving?: boolean;
  // step mode: three action buttons
  mode?: "library" | "step";
  onUse?: (data: { name: string; subject: string | null; body: string }) => void;
  onSaveAsClient?: (data: { name: string; subject: string | null; body: string }) => void;
  onSaveAsGlobal?: (data: { name: string; subject: string | null; body: string }) => void;
  isSavingClient?: boolean;
  isSavingGlobal?: boolean;
}

// ─── Variable chips ───────────────────────────────────────────────────────────

const VARS = ["{business_name}", "{address}", "{phone}", "{email}", "{website}"];

// ─── Prompt Panel ─────────────────────────────────────────────────────────────

interface PromptPanelProps {
  client?: ClientProfile | null;
  onGenerated: (subject: string | null, body: string) => void;
}

function buildDefaultPrompt(c: ClientProfile): string {
  const parts: string[] = [];
  parts.push(`You are an expert outreach copywriter working for "${c.name}".`);
  if (c.business_type) parts.push(`Business type: ${c.business_type}.`);
  if (c.services) parts.push(`Services offered: ${c.services}.`);
  if (c.target_audience) parts.push(`Target audience: ${c.target_audience}.`);
  if (c.pitch) parts.push(`Value proposition: ${c.pitch}.`);
  if (c.tone) parts.push(`Tone: ${c.tone}.`);
  if (c.custom_instructions) parts.push(`Additional instructions: ${c.custom_instructions}.`);
  parts.push("");
  parts.push("Write a professional cold outreach email under 200 words. Be personalized, not spammy.");
  parts.push("Start with 'Subject: <subject line>' on the first line, then a blank line, then the body.");
  parts.push("Only use these placeholders where relevant: {business_name}, {address}, {phone}, {email}, {website}.");
  parts.push("Do NOT use 'Dear [Recipient]', 'Dear [Name]', or any invented placeholder names. Never use square brackets.");
  parts.push("Output ONLY the message. Do not fill in real values for the placeholders.");
  return parts.join("\n");
}

function buildBlankPrompt(): string {
  return [
    "Write a professional cold outreach email under 200 words.",
    "Start with 'Subject: <subject line>' on the first line, then a blank line, then the body.",
    "Only use these placeholders where relevant: {business_name}, {address}, {phone}, {email}, {website}.",
    "Do NOT use 'Dear [Recipient]', 'Dear [Name]', or any invented placeholder names. Never use square brackets.",
    "Output ONLY the message. Do not fill in real values for the placeholders.",
  ].join("\n");
}

export function PromptPanel({ client, onGenerated }: PromptPanelProps) {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const defaultPrompt = client ? buildDefaultPrompt(client) : buildBlankPrompt();
  const [finalPrompt, setFinalPrompt] = useState(defaultPrompt);

  // Reset prompt when client changes
  useEffect(() => {
    setFinalPrompt(client ? buildDefaultPrompt(client) : buildBlankPrompt());
  }, [client?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data } = await (client
        ? api.post<{ template: string }>(`/clients/${client.id}/ai/draft-template`, {
            channel: "email",
            custom_instruction: finalPrompt,
          })
        : api.post<{ template: string }>("/templates/ai/draft", { prompt: finalPrompt }));
      const lines = data.template.split("\n");
      let subject: string | null = null;
      let body = data.template;
      if (lines[0].toLowerCase().startsWith("subject:")) {
        subject = lines[0].replace(/^subject:\s*/i, "").trim();
        body = lines.slice(lines[1] === "" ? 2 : 1).join("\n").trim();
      }
      onGenerated(subject, body);
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
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-muted-foreground">
                Prompt sent to AI
              </label>
              <button
                type="button"
                onClick={() => setFinalPrompt(defaultPrompt)}
                className="text-[11px] text-muted-foreground hover:text-primary hover:underline"
              >
                Reset to default
              </button>
            </div>
            <textarea
              rows={12}
              value={finalPrompt}
              onChange={(e) => setFinalPrompt(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y font-mono leading-relaxed"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              This is the exact prompt sent to AI. Edit anything — context, instructions, variables, format.
            </p>
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
  mode = "library",
  onUse,
  onSaveAsClient,
  onSaveAsGlobal,
  isSavingClient = false,
  isSavingGlobal = false,
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

  const validate = (): { name: string; subject: string | null; body: string } | null => {
    if (mode === "library" && !name.trim()) { toast.error("Template name is required"); return null; }
    if (!body.trim()) { toast.error("Message body is required"); return null; }
    return { name: name.trim(), subject: subject.trim() || null, body: body.trim() };
  };

  const titleText = mode === "step"
    ? "Create Message"
    : initial ? "Edit Template" : "New Template";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl w-full border-border bg-card p-0 gap-0 max-h-[90vh] flex flex-col">
        <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
          <DialogTitle className="text-base font-semibold text-foreground">
            {titleText}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {/* Name — only required in library mode */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Template Name {mode === "library" ? "*" : <span className="text-muted-foreground/60 font-normal">(optional — only needed if saving)</span>}
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
                placeholder="Write your message here, or use Generate with AI below…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            )}

            {!showPreview && (
              <div className="mt-2">
                <p className="text-[10px] text-muted-foreground mb-1.5">
                  Insert variable — replaced with each lead's real data when a campaign sends:
                </p>
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

          {!showPreview && client && (
            <PromptPanel
              client={client}
              onGenerated={(s, b) => {
                setBody(b);
                if (s) setSubject(s);
              }}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border shrink-0">
          {mode === "library" ? (
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { const d = validate(); if (d) onSave?.(d); }}
                disabled={isSaving || !body.trim() || (mode === "library" && !name.trim())}
                className={cn(buttonVariants({ variant: "default", size: "sm" }), "gap-2 min-w-[110px]")}
              >
                {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {initial ? "Save Changes" : "Save Template"}
              </button>
            </div>
          ) : (
            /* Step mode — three actions */
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
              <button type="button" onClick={onClose} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-muted-foreground")}>
                Cancel
              </button>
              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { const d = validate(); if (d) onUse?.(d); }}
                  disabled={!body.trim()}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
                >
                  Use without Saving
                </button>
                {onSaveAsClient && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!name.trim()) { toast.error("Template name is required to save"); return; }
                      const d = validate();
                      if (d) onSaveAsClient(d);
                    }}
                    disabled={isSavingClient || !body.trim()}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5 border-primary/40 text-primary hover:bg-primary/10")}
                  >
                    {isSavingClient && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <BookmarkPlus className="h-3.5 w-3.5" />
                    Save as Client Template
                  </button>
                )}
                {onSaveAsGlobal && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!name.trim()) { toast.error("Template name is required to save"); return; }
                      const d = validate();
                      if (d) onSaveAsGlobal(d);
                    }}
                    disabled={isSavingGlobal || !body.trim()}
                    className={cn(buttonVariants({ variant: "default", size: "sm" }), "gap-1.5")}
                  >
                    {isSavingGlobal && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <Globe className="h-3.5 w-3.5" />
                    Save as Global Template
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
