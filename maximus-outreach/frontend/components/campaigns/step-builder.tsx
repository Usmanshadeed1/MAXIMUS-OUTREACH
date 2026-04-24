"use client";

import { useState, useRef, useCallback } from "react";
import {
  Mail,
  MessageSquare,
  Share2,
  Globe,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  Plus,
  X,
  Eye,
  EyeOff,
  Sparkles,
  Loader2,
  ImagePlus,
  Film,
  FileText,
} from "lucide-react";
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
import type { CampaignStep } from "@/types";
import type { StepCreatePayload, StepUpdatePayload } from "@/lib/hooks/use-campaigns";

// ─── Channel config ───────────────────────────────────────────────────────────

const CHANNELS = [
  { value: "email", label: "Email", icon: Mail, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  { value: "sms", label: "SMS", icon: MessageSquare, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
  { value: "whatsapp", label: "WhatsApp", icon: MessageSquare, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  { value: "social_dm", label: "Social DM", icon: Share2, color: "text-pink-400", bg: "bg-pink-500/10 border-pink-500/20" },
] as const;

function getChannel(value: string) {
  return CHANNELS.find((c) => c.value === value) ?? CHANNELS[0];
}

const TEMPLATE_VARS = [
  "{business_name}", "{address}", "{phone}", "{website}",
  "{rating}", "{reviews}", "{email}", "{source}",
];

// Sample lead data used for live preview
const SAMPLE_LEAD: Record<string, string> = {
  "{business_name}": "Johnson's Kitchen Co.",
  "{address}": "123 Main St, New York, NY",
  "{phone}": "(212) 555-0198",
  "{website}": "www.johnsonskitchen.com",
  "{rating}": "4.7",
  "{reviews}": "128",
  "{email}": "info@johnsonskitchen.com",
  "{source}": "Google Maps",
};

function applyPreview(text: string): string {
  return Object.entries(SAMPLE_LEAD).reduce(
    (msg, [key, val]) => msg.replaceAll(key, val),
    text
  );
}

// ─── Uploaded media item ──────────────────────────────────────────────────────

interface UploadedMedia {
  id: string;
  original_name: string;
  file_type: string;
  mime_type: string;
  file_size: number;
  previewUrl?: string; // blob URL for images
}

function mediaIcon(fileType: string) {
  if (["jpg", "jpeg", "png", "gif"].includes(fileType)) return ImagePlus;
  if (fileType === "mp4") return Film;
  return FileText;
}

// ─── Media uploader ───────────────────────────────────────────────────────────

interface MediaUploaderProps {
  clientId?: string;
  media: UploadedMedia[];
  onChange: (media: UploadedMedia[]) => void;
}

function MediaUploader({ clientId, media, onChange }: MediaUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      const allowed = ["jpg", "jpeg", "png", "gif", "mp4", "pdf"];
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!allowed.includes(ext)) {
        toast.error(`File type .${ext} not allowed`);
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File exceeds 10 MB limit");
        return;
      }

      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const params = clientId ? `?client_id=${clientId}` : "";
        const { data } = await api.post<UploadedMedia>(`/media/upload${params}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        // Create preview URL for images
        let previewUrl: string | undefined;
        if (file.type.startsWith("image/")) {
          previewUrl = URL.createObjectURL(file);
        }

        onChange([...media, { ...data, previewUrl }]);
      } catch {
        toast.error("Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [clientId, media, onChange]
  );

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(uploadFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const removeMedia = (id: string) => {
    const item = media.find((m) => m.id === id);
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    onChange(media.filter((m) => m.id !== id));
  };

  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">
        Media Attachments <span className="text-muted-foreground/60">(optional)</span>
      </label>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed cursor-pointer transition-colors py-5",
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/10"
        )}
      >
        {uploading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <ImagePlus className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        )}
        <p className="text-xs text-muted-foreground text-center">
          {uploading ? "Uploading…" : "Drag & drop or click to upload"}
        </p>
        <p className="text-[10px] text-muted-foreground/60">JPG, PNG, GIF, MP4, PDF · max 10 MB</p>
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.gif,.mp4,.pdf"
          multiple
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Thumbnails */}
      {media.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {media.map((m) => {
            const Icon = mediaIcon(m.file_type);
            return (
              <div
                key={m.id}
                className="relative group rounded-lg border border-border overflow-hidden bg-muted/20"
                style={{ width: 72, height: 72 }}
              >
                {m.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.previewUrl}
                    alt={m.original_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                    <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                    <span className="text-[9px] text-muted-foreground text-center px-1 truncate w-full text-center">
                      {m.original_name}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeMedia(m.id); }}
                  className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Step Editor Dialog ───────────────────────────────────────────────────────

interface StepEditorProps {
  open: boolean;
  onClose: () => void;
  initial?: Partial<CampaignStep>;
  stepOrder: number;
  onSave: (payload: StepCreatePayload | StepUpdatePayload) => void;
  isPending?: boolean;
  isEdit?: boolean;
  clientId?: string;
}

export function StepEditor({
  open,
  onClose,
  initial,
  stepOrder,
  onSave,
  isPending = false,
  isEdit = false,
  clientId,
}: StepEditorProps) {
  const [channel, setChannel] = useState(initial?.channel ?? "email");
  const [delayDays, setDelayDays] = useState(initial?.delay_days ?? 0);
  const [delayHours, setDelayHours] = useState(initial?.delay_hours ?? 0);
  const [template, setTemplate] = useState(initial?.message_template ?? "");
  const [aiInstruction, setAiInstruction] = useState("");
  const [subject, setSubject] = useState(initial?.subject_template ?? "");
  const [media, setMedia] = useState<UploadedMedia[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [showAiInput, setShowAiInput] = useState(false);

  const handleGenerateTemplate = async () => {
    if (!clientId) {
      toast.error("No client context — cannot generate template");
      return;
    }
    setGeneratingAI(true);
    try {
      const { data } = await api.post<{ template: string }>(
        `/clients/${clientId}/ai/draft-template`,
        { channel, custom_instruction: aiInstruction || null }
      );
      setTemplate(data.template);
      setShowPreview(false);
      setShowAiInput(false);
      toast.success("Template drafted — review and edit before saving");
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(detail ?? "AI generation failed — check AI keys in Settings");
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleSave = () => {
    const payload: StepCreatePayload = {
      step_order: stepOrder,
      channel,
      delay_days: delayDays,
      delay_hours: delayHours,
      use_ai_generation: false,
      message_template: template || undefined,
      subject_template: channel === "email" && subject ? subject : undefined,
    };
    onSave(payload);
  };

  const insertVar = (v: string) => setTemplate((t) => t + v);

  const ch = getChannel(channel);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl w-full border-border bg-card p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-semibold text-foreground">
              {isEdit ? "Edit Step" : `Add Step ${stepOrder}`}
            </DialogTitle>
            <button
              onClick={onClose}
              className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-7 w-7 text-muted-foreground")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </DialogHeader>

        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Channel */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Channel</label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {CHANNELS.map((c) => {
                const Icon = c.icon;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setChannel(c.value)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 text-center transition-colors",
                      channel === c.value
                        ? `${c.bg} border-current`
                        : "border-border hover:border-primary/40"
                    )}
                  >
                    <Icon className={cn("h-4 w-4", channel === c.value ? c.color : "text-muted-foreground")} aria-hidden="true" />
                    <span className={cn("text-[11px] font-medium", channel === c.value ? "text-foreground" : "text-muted-foreground")}>
                      {c.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Delay */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">
              Delay after previous step
            </label>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={delayDays}
                  onChange={(e) => setDelayDays(parseInt(e.target.value, 10) || 0)}
                  className="w-20 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <span className="text-xs text-muted-foreground">days</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={delayHours}
                  onChange={(e) => setDelayHours(parseInt(e.target.value, 10) || 0)}
                  className="w-20 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <span className="text-xs text-muted-foreground">hours</span>
              </div>
              {delayDays === 0 && delayHours === 0 && (
                <span className="text-xs text-amber-400">Sends immediately</span>
              )}
            </div>
          </div>

          {/* Email subject */}
          {channel === "email" && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Email Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject line (use {business_name} etc.)"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          )}

          {/* Message template */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-muted-foreground">
                Message Template
              </label>
              <div className="flex items-center gap-2">
                {template && (
                  <button
                    type="button"
                    onClick={() => setShowPreview((p) => !p)}
                    className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                  >
                    {showPreview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    {showPreview ? "Edit" : "Preview"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowAiInput((v) => !v)}
                  className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  <Sparkles className="h-3 w-3" />
                  Generate with AI
                </button>
              </div>
            </div>

            {/* AI draft panel */}
            {showAiInput && (
              <div className="mb-3 rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                <p className="text-[11px] text-muted-foreground">
                  AI will draft a template using this client's profile. You can edit it before saving.
                </p>
                <input
                  type="text"
                  value={aiInstruction}
                  onChange={(e) => setAiInstruction(e.target.value)}
                  placeholder="Optional: e.g. keep it under 80 words, mention kitchen remodeling"
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={handleGenerateTemplate}
                  disabled={generatingAI}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "gap-2 border-primary/40 text-primary hover:bg-primary/10 w-full justify-center"
                  )}
                >
                  {generatingAI
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Sparkles className="h-3.5 w-3.5" />}
                  {generatingAI ? "Generating…" : "Draft Template"}
                </button>
              </div>
            )}

            {showPreview ? (
              <div className="rounded-md border border-border bg-muted/20 px-4 py-3 text-sm text-foreground whitespace-pre-wrap min-h-[120px]">
                {applyPreview(template) || <span className="text-muted-foreground italic">Nothing to preview yet</span>}
                <p className="mt-3 pt-3 border-t border-border text-[10px] text-muted-foreground">
                  Previewed with sample lead: <strong>Johnson's Kitchen Co.</strong>
                </p>
              </div>
            ) : (
              <textarea
                rows={6}
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                placeholder="Write your message…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            )}

            {/* Variable chips */}
            {!showPreview && (
              <div className="mt-2">
                <p className="text-[10px] text-muted-foreground mb-1.5">Insert variable:</p>
                <div className="flex flex-wrap gap-1.5">
                  {TEMPLATE_VARS.map((v) => (
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

          {/* Media upload — for WhatsApp, email, social_dm */}
          {["whatsapp", "email", "social_dm"].includes(channel) && (
            <MediaUploader clientId={clientId} media={media} onChange={setMedia} />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
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
            disabled={isPending}
            className={cn(buttonVariants({ variant: "default", size: "sm" }), "gap-2")}
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isEdit ? "Save Changes" : "Add Step"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Step Card ────────────────────────────────────────────────────────────────

interface StepCardProps {
  step: CampaignStep;
  isFirst: boolean;
  isLast: boolean;
  isEditable: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function StepCard({
  step,
  isFirst,
  isLast,
  isEditable,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: StepCardProps) {
  const ch = getChannel(step.channel);
  const Icon = ch.icon;

  const delayText =
    step.delay_days === 0 && step.delay_hours === 0
      ? "Immediately"
      : [
          step.delay_days ? `${step.delay_days}d` : "",
          step.delay_hours ? `${step.delay_hours}h` : "",
        ]
          .filter(Boolean)
          .join(" ") + " later";

  return (
    <div className="flex gap-3">
      {/* Timeline indicator */}
      <div className="flex flex-col items-center">
        <div className={cn("h-9 w-9 rounded-lg border flex items-center justify-center shrink-0", ch.bg)}>
          <Icon className={cn("h-4 w-4", ch.color)} aria-hidden="true" />
        </div>
        {!isLast && <div className="w-px flex-1 bg-border mt-1 min-h-[16px]" />}
      </div>

      {/* Card */}
      <div className="flex-1 rounded-xl border border-border bg-card px-4 py-3 mb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn("text-xs font-medium", ch.color)}>{ch.label}</span>
              <span className="text-[11px] text-muted-foreground">Step {step.step_order}</span>
              <span className="text-[11px] text-muted-foreground">·</span>
              <span className="text-[11px] text-muted-foreground">{delayText}</span>
              {step.use_ai_generation && (
                <>
                  <span className="text-[11px] text-muted-foreground">·</span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-primary">
                    <Sparkles className="h-3 w-3" />
                    AI
                  </span>
                </>
              )}
            </div>
            {step.subject_template && (
              <p className="text-xs text-foreground mt-0.5 font-medium truncate">
                Subject: {step.subject_template}
              </p>
            )}
            {!step.use_ai_generation && step.message_template && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {step.message_template}
              </p>
            )}
            {step.use_ai_generation && step.ai_prompt_override && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1 italic">
                Override: {step.ai_prompt_override}
              </p>
            )}
          </div>

          {/* Actions */}
          {isEditable && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={onMoveUp}
                disabled={isFirst}
                title="Move up"
                className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-7 w-7 text-muted-foreground disabled:opacity-30")}
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={onMoveDown}
                disabled={isLast}
                title="Move down"
                className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-7 w-7 text-muted-foreground disabled:opacity-30")}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={onEdit}
                title="Edit step"
                className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-7 w-7 text-muted-foreground hover:text-foreground")}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={onDelete}
                title="Delete step"
                className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-7 w-7 text-muted-foreground hover:text-rose-400")}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Step Builder (list + add) ────────────────────────────────────────────────

interface StepBuilderProps {
  steps: CampaignStep[];
  isEditable: boolean;
  clientId?: string;
  onAdd: (payload: StepCreatePayload) => void;
  onUpdate: (stepId: string, payload: StepUpdatePayload) => void;
  onDelete: (stepId: string) => void;
  onMoveUp: (stepId: string) => void;
  onMoveDown: (stepId: string) => void;
  isPending?: boolean;
}

export function StepBuilder({
  steps,
  isEditable,
  clientId,
  onAdd,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  isPending = false,
}: StepBuilderProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [editStep, setEditStep] = useState<CampaignStep | null>(null);

  const sorted = [...steps].sort((a, b) => a.step_order - b.step_order);

  return (
    <div>
      {/* Empty state */}
      {sorted.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 py-8 rounded-xl border border-dashed border-border">
          <Globe className="h-8 w-8 text-muted-foreground/30" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">No steps yet</p>
          {isEditable && (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2 mt-1")}
            >
              <Plus className="h-3.5 w-3.5" />
              Add First Step
            </button>
          )}
        </div>
      )}

      {/* Steps */}
      {sorted.map((step, idx) => (
        <StepCard
          key={step.id}
          step={step}
          isFirst={idx === 0}
          isLast={idx === sorted.length - 1}
          isEditable={isEditable}
          onEdit={() => setEditStep(step)}
          onDelete={() => onDelete(step.id)}
          onMoveUp={() => onMoveUp(step.id)}
          onMoveDown={() => onMoveDown(step.id)}
        />
      ))}

      {/* Add step button */}
      {isEditable && sorted.length > 0 && (
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "gap-2 w-full mt-1 border-dashed"
          )}
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Add Step
        </button>
      )}

      {/* Add step dialog */}
      <StepEditor
        open={addOpen}
        onClose={() => setAddOpen(false)}
        stepOrder={sorted.length + 1}
        clientId={clientId}
        onSave={(payload) => {
          onAdd(payload as StepCreatePayload);
          setAddOpen(false);
        }}
        isPending={isPending}
      />

      {/* Edit step dialog */}
      {editStep && (
        <StepEditor
          open={!!editStep}
          onClose={() => setEditStep(null)}
          initial={editStep}
          stepOrder={editStep.step_order}
          clientId={clientId}
          onSave={(payload) => {
            onUpdate(editStep.id, payload as StepUpdatePayload);
            setEditStep(null);
          }}
          isPending={isPending}
          isEdit
        />
      )}
    </div>
  );
}
