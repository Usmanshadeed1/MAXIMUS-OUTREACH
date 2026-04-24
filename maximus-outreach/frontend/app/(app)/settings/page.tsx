"use client";

import { useEffect, useId, isValidElement, cloneElement, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import {
  Plus,
  Pencil,
  Trash2,
  FlaskConical,
  Flame,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  X,
  Brain,
  Mail,
  Phone,
  MessageCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  useSmtpAccounts,
  useCreateSmtp,
  useUpdateSmtp,
  useDeleteSmtp,
  useTestSmtp,
  useStartWarmup,
  type SmtpAccount,
  type SmtpCreate,
} from "@/lib/hooks/use-smtp-settings";
import {
  useAiKeys,
  useCreateAiKey,
  useUpdateAiKey,
  useDeleteAiKey,
  useTestAiKey,
  type AiKey,
  type AiKeyCreate,
  type AiProvider,
} from "@/lib/hooks/use-ai-settings";
import {
  useSmsSetting,
  useSaveSmsSetting,
  useTestSmsSetting,
  useSmsNumbers,
  useCreateSmsNumber,
  useUpdateSmsNumber,
  useDeleteSmsNumber,
  type SmsSetting,
  type SmsProvider,
  type SmsSettingCreate,
  type SmsNumber,
  type SmsNumberCreate,
  type SmsNumberUpdate,
} from "@/lib/hooks/use-sms-settings";
import {
  useWhatsAppSettings,
  useSaveWhatsAppSettings,
  useTestWhatsAppSettings,
  useWhatsAppNumbers,
  useCreateWhatsAppNumber,
  useUpdateWhatsAppNumber,
  useDeleteWhatsAppNumber,
  type WhatsAppSettings,
  type WhatsAppSettingsCreate,
  type WhatsAppNumber,
  type WhatsAppNumberCreate,
  type WhatsAppNumberUpdate,
} from "@/lib/hooks/use-whatsapp-settings";
import { useFocusTrap } from "@/lib/hooks/use-focus-trap";
import { usePageTitle } from "@/lib/hooks/use-page-title";
import { useClients } from "@/lib/hooks/use-clients";

// ─── Shared primitives ───────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background transition-shadow";

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;

  // Thread id + aria onto the direct child input/select/textarea
  const enhanced = isValidElement(children)
    ? cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        id,
        ...(hintId ? { "aria-describedby": hintId } : {}),
        ...(required ? { "aria-required": true } : {}),
      })
    : children;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="text-xs font-medium text-muted-foreground cursor-default"
      >
        {label}
        {required && (
          <>
            <span aria-hidden="true" className="text-destructive ml-0.5">*</span>
            <span className="sr-only"> (required)</span>
          </>
        )}
      </label>
      {enhanced}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className="inline-flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
    >
      <div
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors",
          value ? "bg-primary" : "bg-muted/50"
        )}
        aria-hidden="true"
      >
        <div
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
            value ? "translate-x-4" : "translate-x-0.5"
          )}
        />
      </div>
      <span className="text-sm text-foreground">{label}</span>
    </button>
  );
}

function DialogShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const dialogRef = useFocusTrap<HTMLDivElement>();

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    // Backdrop — click outside to close
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}
      aria-hidden="true"
    >
      {/* Dialog panel — stop propagation */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl overflow-y-auto max-h-[90vh]"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 id={titleId} className="text-base font-semibold text-foreground">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Health badge ─────────────────────────────────────────────────────────────

function HealthBadge({ status }: { status: string }) {
  if (status === "healthy") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[11px] font-medium text-green-400">
        <CheckCircle2 className="h-3 w-3" /> Healthy
      </span>
    );
  }
  if (status === "failing") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-400">
        <XCircle className="h-3 w-3" /> Failing
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/20 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      <Clock className="h-3 w-3" /> Untested
    </span>
  );
}

// ─── SMTP Form Dialog ─────────────────────────────────────────────────────────

function SmtpFormDialog({
  existing,
  onClose,
}: {
  existing?: SmtpAccount;
  onClose: () => void;
}) {
  const createMut = useCreateSmtp();
  const updateMut = useUpdateSmtp();
  const busy = createMut.isPending || updateMut.isPending;

  const [form, setForm] = useState({
    name: existing?.name ?? "",
    host: existing?.host ?? "",
    port: existing?.port ?? 587,
    username: existing?.username ?? "",
    password: "",
    from_email: existing?.from_email ?? "",
    from_name: existing?.from_name ?? "",
    use_tls: existing?.use_tls ?? true,
    is_default: existing?.is_default ?? false,
    daily_limit: existing?.daily_limit ?? 200,
    warmup_enabled: existing?.warmup_enabled ?? false,
  });

  const set = (k: string, v: string | number | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: SmtpCreate = {
      name: form.name,
      host: form.host,
      port: Number(form.port),
      username: form.username,
      password: form.password,
      from_email: form.from_email || undefined,
      from_name: form.from_name || undefined,
      use_tls: form.use_tls,
      is_default: form.is_default,
      daily_limit: Number(form.daily_limit),
      warmup_enabled: form.warmup_enabled,
    };
    if (existing) {
      updateMut.mutate(
        { id: existing.id, ...payload },
        {
          onSuccess: () => { toast.success("SMTP account updated"); onClose(); },
          onError: () => toast.error("Failed to update SMTP account"),
        }
      );
    } else {
      createMut.mutate(payload, {
        onSuccess: () => { toast.success("SMTP account added"); onClose(); },
        onError: () => toast.error("Failed to add SMTP account"),
      });
    }
  };

  return (
    <DialogShell
      title={existing ? "Edit SMTP Account" : "Add SMTP Account"}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
        <Field label="Account Name" required>
          <input value={form.name} onChange={(e) => set("name", e.target.value)} required
            placeholder="e.g. Main Outreach" className={inputCls} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Field label="SMTP Host" required>
              <input value={form.host} onChange={(e) => set("host", e.target.value)} required
                placeholder="smtp.gmail.com" className={inputCls} />
            </Field>
          </div>
          <Field label="Port" required>
            <input type="number" value={form.port} onChange={(e) => set("port", e.target.value)} required
              min={1} max={65535} className={inputCls} />
          </Field>
        </div>
        <Field label="Username" required>
          <input value={form.username} onChange={(e) => set("username", e.target.value)} required
            placeholder="user@example.com" className={inputCls} />
        </Field>
        <Field label={existing ? "Password (leave blank to keep)" : "Password"} required={!existing}>
          <input type="password" value={form.password} onChange={(e) => set("password", e.target.value)}
            required={!existing} placeholder="••••••••" className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From Email">
            <input value={form.from_email} onChange={(e) => set("from_email", e.target.value)}
              placeholder="noreply@example.com" className={inputCls} />
          </Field>
          <Field label="From Name">
            <input value={form.from_name} onChange={(e) => set("from_name", e.target.value)}
              placeholder="Acme Inc." className={inputCls} />
          </Field>
        </div>
        <Field label="Daily Send Limit" required>
          <input type="number" value={form.daily_limit} onChange={(e) => set("daily_limit", e.target.value)}
            required min={1} className={inputCls} />
        </Field>
        <div className="flex flex-wrap gap-4">
          <Toggle label="TLS" value={form.use_tls} onChange={(v) => set("use_tls", v)} />
          <Toggle label="Set as Default" value={form.is_default} onChange={(v) => set("is_default", v)} />
          <Toggle label="Email Warmup" value={form.warmup_enabled} onChange={(v) => set("warmup_enabled", v)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={busy}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {existing ? "Save Changes" : "Add Account"}
          </button>
        </div>
      </form>
    </DialogShell>
  );
}

// ─── SMTP Test Dialog ─────────────────────────────────────────────────────────

function SmtpTestDialog({ smtpId, onClose }: { smtpId: string; onClose: () => void }) {
  const [toEmail, setToEmail] = useState("");
  const testMut = useTestSmtp();

  const handleTest = (e: React.FormEvent) => {
    e.preventDefault();
    testMut.mutate(
      { id: smtpId, to_email: toEmail },
      {
        onSuccess: (r) => {
          if (r.success) toast.success(`Test passed in ${r.latency_ms}ms`);
          else toast.error(`Test failed: ${r.error}`);
          onClose();
        },
        onError: () => { toast.error("Test request failed"); onClose(); },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Send Test Email</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleTest} className="px-6 py-5 space-y-4">
          <Field label="Send test to" required>
            <input type="email" value={toEmail} onChange={(e) => setToEmail(e.target.value)}
              required placeholder="you@example.com" className={inputCls} />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={testMut.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {testMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
              Send Test
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── SMTP Card ────────────────────────────────────────────────────────────────

function SmtpCard({ account }: { account: SmtpAccount }) {
  const deleteMut = useDeleteSmtp();
  const warmupMut = useStartWarmup();
  const [editing, setEditing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);
  const busy = deleteMut.isPending || warmupMut.isPending;

  const handleDelete = () => {
    if (!delConfirm) { setDelConfirm(true); return; }
    deleteMut.mutate(account.id, {
      onSuccess: () => toast.success("SMTP account deleted"),
      onError: () => toast.error("Failed to delete"),
    });
  };

  const handleWarmup = () => {
    warmupMut.mutate(account.id, {
      onSuccess: (r) => toast.success(`Warmup started — Day 1 limit: ${r.schedule[0]?.daily_limit ?? "?"} emails`),
      onError: () => toast.error("Failed to start warmup"),
    });
  };

  const usePct = account.daily_limit > 0
    ? Math.min(100, Math.round((account.sent_today / account.daily_limit) * 100))
    : 0;

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-foreground">{account.name}</h3>
              {account.is_default && (
                <span className="text-[11px] font-medium border border-primary/30 bg-primary/10 text-primary px-2 py-0.5 rounded-full">Default</span>
              )}
              {!account.is_active && (
                <span className="text-[11px] font-medium border border-border bg-muted/20 text-muted-foreground px-2 py-0.5 rounded-full">Inactive</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{account.host}:{account.port} · {account.username}</p>
          </div>
          <HealthBadge status={account.health_status} />
        </div>

        {/* Send quota */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Sent today</span>
            <span className="text-xs font-medium text-foreground">
              {account.sent_today.toLocaleString()} / {account.daily_limit.toLocaleString()}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted/30">
            <div
              className={cn("h-1.5 rounded-full transition-all", usePct >= 90 ? "bg-red-500" : usePct >= 70 ? "bg-amber-500" : "bg-primary")}
              style={{ width: `${usePct}%` }}
            />
          </div>
        </div>

        {/* Warmup status */}
        {account.warmup_enabled && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
            <Flame className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span className="text-xs text-amber-400">
              {account.warmup_start_date
                ? `Warmup active — current limit: ${account.warmup_current_daily_limit}/day`
                : "Warmup enabled — not started"}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 items-center">
          <button type="button" onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/30 transition-colors">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button type="button" onClick={() => setTesting(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-500/20 transition-colors">
            <FlaskConical className="h-3.5 w-3.5" /> Test
          </button>
          {account.warmup_enabled && !account.warmup_start_date && (
            <button type="button" onClick={handleWarmup} disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50">
              {warmupMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Flame className="h-3.5 w-3.5" />}
              Start Warmup
            </button>
          )}
          <button type="button" onClick={handleDelete} disabled={busy}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ml-auto",
              delConfirm
                ? "border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                : "border-border bg-background text-muted-foreground hover:text-destructive"
            )}>
            {deleteMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            {delConfirm ? "Confirm Delete" : "Delete"}
          </button>
          {delConfirm && (
            <button type="button" onClick={() => setDelConfirm(false)} className="text-xs text-muted-foreground hover:text-foreground">
              Cancel
            </button>
          )}
        </div>
      </div>

      {editing && <SmtpFormDialog existing={account} onClose={() => setEditing(false)} />}
      {testing && <SmtpTestDialog smtpId={account.id} onClose={() => setTesting(false)} />}
    </>
  );
}

function SmtpTab() {
  const [addOpen, setAddOpen] = useState(false);
  const { data: accounts = [], isLoading } = useSmtpAccounts();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">SMTP Accounts</h2>
          <p className="text-sm text-muted-foreground">Outbound email accounts with daily limits and warmup.</p>
        </div>
        <button type="button" onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" /> Add SMTP
        </button>
      </div>
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((n) => <Skeleton key={n} className="h-40 rounded-xl" />)}
        </div>
      ) : accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">No SMTP accounts configured</p>
          <button type="button" onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/30 transition-colors">
            <Plus className="h-4 w-4" /> Add First Account
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {accounts.map((acc) => <SmtpCard key={acc.id} account={acc} />)}
        </div>
      )}
      {addOpen && <SmtpFormDialog onClose={() => setAddOpen(false)} />}
    </div>
  );
}

// ─── AI Key Form Dialog ───────────────────────────────────────────────────────

const PROVIDER_DEFAULTS: Record<AiProvider, { base_url: string; placeholder: string }> = {
  openrouter: {
    base_url: "https://openrouter.ai/api/v1",
    placeholder: "e.g. openai/gpt-4o-mini",
  },
  groq: {
    base_url: "https://api.groq.com/openai/v1",
    placeholder: "e.g. llama3-8b-8192",
  },
};

function AiKeyFormDialog({
  existing,
  onClose,
}: {
  existing?: AiKey;
  onClose: () => void;
}) {
  const createMut = useCreateAiKey();
  const updateMut = useUpdateAiKey();
  const busy = createMut.isPending || updateMut.isPending;

  const [apiKey, setApiKey] = useState("");
  const [modelName, setModelName] = useState(existing?.model_name ?? "");

  // Auto-detect provider + base_url from API key prefix
  function detectProvider(key: string): { provider: AiProvider; base_url: string } {
    if (key.startsWith("gsk_")) return { provider: "groq", base_url: PROVIDER_DEFAULTS.groq.base_url };
    if (key.startsWith("sk-or-")) return { provider: "openrouter", base_url: PROVIDER_DEFAULTS.openrouter.base_url };
    return { provider: "groq", base_url: PROVIDER_DEFAULTS.groq.base_url };
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { provider, base_url } = detectProvider(apiKey);
    const payload: AiKeyCreate = {
      provider,
      base_url,
      api_key: apiKey,
      model_name: modelName,
      label: undefined,
      priority: 0,
      daily_limit: 1000,
    };
    if (existing) {
      updateMut.mutate(
        { id: existing.id, ...payload },
        {
          onSuccess: () => { toast.success("AI key updated"); onClose(); },
          onError: () => toast.error("Failed to update AI key"),
        }
      );
    } else {
      createMut.mutate(payload, {
        onSuccess: () => { toast.success("AI key added"); onClose(); },
        onError: () => toast.error("Failed to add AI key"),
      });
    }
  };

  return (
    <DialogShell title={existing ? "Edit AI Key" : "Add AI Key"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
        <Field label={existing ? "API Key (leave blank to keep)" : "API Key"} required={!existing}>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            required={!existing}
            placeholder={existing ? `Current: ${existing.api_key_masked}` : "gsk_... or sk-or-..."}
            className={inputCls}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Groq keys start with <code>gsk_</code> · OpenRouter keys start with <code>sk-or-</code>
          </p>
        </Field>
        <Field label="Model Name" required>
          <input
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            required
            placeholder="e.g. llama-3.1-8b-instant"
            className={inputCls}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Groq: <code>llama-3.1-8b-instant</code>, <code>llama-3.3-70b-versatile</code>, <code>gemma2-9b-it</code>
          </p>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={busy}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {existing ? "Save Changes" : "Add Key"}
          </button>
        </div>
      </form>
    </DialogShell>
  );
}

// ─── AI Key Card ──────────────────────────────────────────────────────────────

function AiKeyCard({ aiKey }: { aiKey: AiKey }) {
  const deleteMut = useDeleteAiKey();
  const testMut = useTestAiKey();
  const updateMut = useUpdateAiKey();
  const [editing, setEditing] = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);
  const busy = deleteMut.isPending || testMut.isPending || updateMut.isPending;

  const usePct = aiKey.daily_limit > 0
    ? Math.min(100, Math.round((aiKey.requests_today / aiKey.daily_limit) * 100))
    : 0;

  const handleDelete = () => {
    if (!delConfirm) { setDelConfirm(true); return; }
    deleteMut.mutate(aiKey.id, {
      onSuccess: () => toast.success("AI key deleted"),
      onError: () => toast.error("Failed to delete"),
    });
  };

  const handleTest = () => {
    testMut.mutate(aiKey.id, {
      onSuccess: (r) => {
        if (r.success)
          toast.success(`Test passed in ${r.latency_ms}ms — "${r.response_text?.slice(0, 60) ?? "OK"}"`);
        else toast.error(`Test failed: ${r.error}`);
      },
      onError: () => toast.error("Test request failed"),
    });
  };

  const handleToggleActive = () => {
    updateMut.mutate(
      { id: aiKey.id, is_active: !aiKey.is_active },
      {
        onSuccess: () => toast.success(aiKey.is_active ? "Key deactivated" : "Key activated"),
        onError: () => toast.error("Failed to update"),
      }
    );
  };

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn(
                "text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                aiKey.provider === "openrouter"
                  ? "border-violet-500/30 bg-violet-500/10 text-violet-400"
                  : "border-orange-500/30 bg-orange-500/10 text-orange-400"
              )}>
                {aiKey.provider}
              </span>
              <h3 className="font-semibold text-foreground">{aiKey.model_name}</h3>
              {aiKey.label && (
                <span className="text-xs text-muted-foreground">— {aiKey.label}</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Priority: {aiKey.priority} · Key: {aiKey.api_key_masked}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <HealthBadge status={aiKey.health_status} />
            {!aiKey.is_active && (
              <span className="text-[11px] font-medium border border-border bg-muted/20 text-muted-foreground px-2 py-0.5 rounded-full">
                Inactive
              </span>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Requests today</span>
            <span className="text-xs font-medium text-foreground">
              {aiKey.requests_today.toLocaleString()} / {aiKey.daily_limit.toLocaleString()}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted/30">
            <div
              className={cn(
                "h-1.5 rounded-full transition-all",
                usePct >= 90 ? "bg-red-500" : usePct >= 70 ? "bg-amber-500" : "bg-primary"
              )}
              style={{ width: `${usePct}%` }}
            />
          </div>
        </div>

        {aiKey.last_error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
            <p className="text-xs text-red-400 truncate">{aiKey.last_error}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2 items-center">
          <button type="button" onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/30 transition-colors">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button type="button" onClick={handleTest} disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-50">
            {testMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
            Test
          </button>
          <button type="button" onClick={handleToggleActive} disabled={busy}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
              aiKey.is_active
                ? "border-border bg-background text-muted-foreground hover:text-foreground"
                : "border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20"
            )}>
            {updateMut.isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : aiKey.is_active ? "Deactivate" : "Activate"
            }
          </button>
          <button type="button" onClick={handleDelete} disabled={busy}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ml-auto",
              delConfirm
                ? "border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                : "border-border bg-background text-muted-foreground hover:text-destructive"
            )}>
            {deleteMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            {delConfirm ? "Confirm Delete" : "Delete"}
          </button>
          {delConfirm && (
            <button type="button" onClick={() => setDelConfirm(false)}
              className="text-xs text-muted-foreground hover:text-foreground">
              Cancel
            </button>
          )}
        </div>
      </div>
      {editing && <AiKeyFormDialog existing={aiKey} onClose={() => setEditing(false)} />}
    </>
  );
}

function AiModelsTab() {
  const [addOpen, setAddOpen] = useState(false);
  const { data: keys = [], isLoading } = useAiKeys();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">AI Models</h2>
          <p className="text-sm text-muted-foreground">
            OpenRouter and Groq API keys with per-model routing and daily limits.
          </p>
        </div>
        <button type="button" onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" /> Add Key
        </button>
      </div>
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((n) => <Skeleton key={n} className="h-44 rounded-xl" />)}
        </div>
      ) : keys.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 rounded-xl border border-dashed border-border">
          <Brain className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No AI keys configured</p>
          <button type="button" onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/30 transition-colors">
            <Plus className="h-4 w-4" /> Add First Key
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {keys.map((k) => <AiKeyCard key={k.id} aiKey={k} />)}
        </div>
      )}
      {addOpen && <AiKeyFormDialog onClose={() => setAddOpen(false)} />}
    </div>
  );
}

// ─── SMS components ──────────────────────────────────────────────────────────

function SmsProviderForm({ current }: { current: SmsSetting | null }) {
  const saveMut = useSaveSmsSetting();
  const testMut = useTestSmsSetting();
  const busy = saveMut.isPending;

  const [provider, setProvider] = useState<SmsProvider>(current?.provider ?? "twilio");
  const [twilioSid, setTwilioSid] = useState(current?.twilio_account_sid ?? "");
  const [twilioToken, setTwilioToken] = useState("");
  const [telnyxKey, setTelnyxKey] = useState("");
  const [telnyxWebhook, setTelnyxWebhook] = useState("");

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: SmsSettingCreate = {
      provider,
      twilio_account_sid: provider === "twilio" ? twilioSid || undefined : undefined,
      twilio_auth_token: provider === "twilio" && twilioToken ? twilioToken : undefined,
      telnyx_api_key: provider === "telnyx" && telnyxKey ? telnyxKey : undefined,
      telnyx_webhook_public_key: provider === "telnyx" && telnyxWebhook ? telnyxWebhook : undefined,
    };
    saveMut.mutate(payload, {
      onSuccess: () => toast.success("SMS provider saved"),
      onError: () => toast.error("Failed to save SMS provider"),
    });
  };

  const handleTest = () => {
    testMut.mutate(undefined, {
      onSuccess: (r) =>
        r.success ? toast.success(`${r.provider} test passed`) : toast.error(`Test failed: ${r.error}`),
      onError: () => toast.error("Test request failed"),
    });
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-semibold text-foreground">Provider Configuration</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {current ? `Active: ${current.provider}` : "No provider configured"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {current && <HealthBadge status={current.health_status} />}
          {current && (
            <button type="button" onClick={handleTest} disabled={testMut.isPending}
              className="inline-flex items-center gap-1.5 rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-50">
              {testMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
              Test
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <Field label="Provider" required>
          <div className="flex gap-2">
            {(["twilio", "telnyx"] as SmsProvider[]).map((p) => (
              <button key={p} type="button" onClick={() => setProvider(p)}
                className={cn(
                  "flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors capitalize",
                  provider === p
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                )}>
                {p}
              </button>
            ))}
          </div>
        </Field>

        {provider === "twilio" && (
          <>
            <Field label="Account SID">
              <input value={twilioSid} onChange={(e) => setTwilioSid(e.target.value)}
                placeholder={current?.twilio_account_sid ?? "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}
                className={inputCls} />
            </Field>
            <Field label={current ? "Auth Token (leave blank to keep)" : "Auth Token"}>
              <input type="password" value={twilioToken} onChange={(e) => setTwilioToken(e.target.value)}
                placeholder="••••••••" className={inputCls} />
            </Field>
          </>
        )}

        {provider === "telnyx" && (
          <>
            <Field label={current?.telnyx_configured ? "API Key (leave blank to keep)" : "API Key"}>
              <input type="password" value={telnyxKey} onChange={(e) => setTelnyxKey(e.target.value)}
                placeholder={current?.telnyx_configured ? "Currently configured" : "KEY01..."}
                className={inputCls} />
            </Field>
            <Field label={current?.telnyx_webhook_configured ? "Webhook Public Key (leave blank to keep)" : "Webhook Public Key"}>
              <input type="password" value={telnyxWebhook} onChange={(e) => setTelnyxWebhook(e.target.value)}
                placeholder={current?.telnyx_webhook_configured ? "Currently configured" : "Ed25519 public key from Telnyx portal"}
                className={inputCls} />
            </Field>
          </>
        )}

        <div className="flex justify-end">
          <button type="submit" disabled={busy}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {current ? "Update Provider" : "Save Provider"}
          </button>
        </div>
      </form>
    </div>
  );
}

function SmsNumberForm({
  existing,
  onClose,
}: {
  existing?: SmsNumber;
  onClose: () => void;
}) {
  const createMut = useCreateSmsNumber();
  const updateMut = useUpdateSmsNumber();
  const busy = createMut.isPending || updateMut.isPending;
  const { data: clientsData } = useClients(1, 100);
  const clients = clientsData?.items ?? [];

  const [form, setForm] = useState<SmsNumberCreate>({
    phone_number: existing?.phone_number ?? "",
    label: existing?.label ?? "",
    daily_limit: existing?.daily_limit ?? 500,
    client_id: existing?.client_id ?? undefined,
  });
  const set = (k: string, v: string | number | undefined) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      phone_number: form.phone_number!,
      label: form.label || undefined,
      daily_limit: Number(form.daily_limit),
      client_id: form.client_id || undefined,
    };
    if (existing) {
      updateMut.mutate(
        { id: existing.id, ...payload },
        {
          onSuccess: () => { toast.success("Number updated"); onClose(); },
          onError: () => toast.error("Failed to update number"),
        }
      );
    } else {
      createMut.mutate(payload, {
        onSuccess: () => { toast.success("Number added"); onClose(); },
        onError: () => toast.error("Failed to add number"),
      });
    }
  };

  return (
    <DialogShell title={existing ? "Edit Phone Number" : "Add Phone Number"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
        <Field label="Phone Number" required>
          <input value={form.phone_number} onChange={(e) => set("phone_number", e.target.value)}
            required placeholder="+15551234567" className={inputCls} />
        </Field>
        <Field label="Label">
          <input value={form.label ?? ""} onChange={(e) => set("label", e.target.value)}
            placeholder="e.g. US Outreach Line" className={inputCls} />
        </Field>
        <Field label="Assign to Client" hint="Which client sends SMS from this number">
          <select
            value={form.client_id ?? ""}
            onChange={(e) => set("client_id", e.target.value || undefined)}
            className={inputCls}
          >
            <option value="">— Pool (unassigned) —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Daily Send Limit" required>
          <input type="number" value={form.daily_limit} onChange={(e) => set("daily_limit", e.target.value)}
            required min={1} max={10000} className={inputCls} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={busy}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {existing ? "Save" : "Add Number"}
          </button>
        </div>
      </form>
    </DialogShell>
  );
}

function SmsNumberCard({ number }: { number: SmsNumber }) {
  const deleteMut = useDeleteSmsNumber();
  const updateMut = useUpdateSmsNumber();
  const [editing, setEditing] = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);
  const busy = deleteMut.isPending || updateMut.isPending;
  const { data: clientsData } = useClients(1, 100);
  const clients = clientsData?.items ?? [];
  const assignedClient = clients.find((c) => c.id === number.client_id);

  const usePct = number.daily_limit > 0
    ? Math.min(100, Math.round((number.sent_today / number.daily_limit) * 100))
    : 0;

  const handleDelete = () => {
    if (!delConfirm) { setDelConfirm(true); return; }
    deleteMut.mutate(number.id, {
      onSuccess: () => toast.success("Number deleted"),
      onError: () => toast.error("Failed to delete"),
    });
  };

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium text-foreground text-sm">{number.phone_number}</p>
            {number.label && <p className="text-xs text-muted-foreground">{number.label}</p>}
            <p className="text-xs text-muted-foreground">
              {assignedClient ? `Client: ${assignedClient.name}` : "Pool (unassigned)"}
            </p>
          </div>
          {!number.is_active && (
            <span className="text-[11px] border border-border bg-muted/20 text-muted-foreground px-2 py-0.5 rounded-full">
              Inactive
            </span>
          )}
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-xs text-muted-foreground">Sent today</span>
            <span className="text-xs font-medium text-foreground">
              {number.sent_today.toLocaleString()} / {number.daily_limit.toLocaleString()}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted/30">
            <div className={cn("h-1.5 rounded-full", usePct >= 90 ? "bg-red-500" : usePct >= 70 ? "bg-amber-500" : "bg-primary")}
              style={{ width: `${usePct}%` }} />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/30 transition-colors">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button type="button" onClick={handleDelete} disabled={busy}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ml-auto",
              delConfirm
                ? "border-red-500/40 bg-red-500/10 text-red-400"
                : "border-border bg-background text-muted-foreground hover:text-destructive"
            )}>
            {deleteMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            {delConfirm ? "Confirm" : "Delete"}
          </button>
          {delConfirm && (
            <button type="button" onClick={() => setDelConfirm(false)}
              className="text-xs text-muted-foreground hover:text-foreground">
              Cancel
            </button>
          )}
        </div>
      </div>
      {editing && <SmsNumberForm existing={number} onClose={() => setEditing(false)} />}
    </>
  );
}

function SmsTab() {
  const [addOpen, setAddOpen] = useState(false);
  const { data: setting, isLoading: settingLoading } = useSmsSetting();
  const { data: numbers = [], isLoading: numbersLoading } = useSmsNumbers();

  return (
    <div className="space-y-6">
      {settingLoading ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : (
        <SmsProviderForm current={setting ?? null} />
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">SMS Phone Numbers</h2>
            <p className="text-sm text-muted-foreground">Outbound numbers with daily send limits.</p>
          </div>
          <button type="button" onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="h-4 w-4" /> Add Number
          </button>
        </div>
        {numbersLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[1, 2].map((n) => <Skeleton key={n} className="h-28 rounded-xl" />)}
          </div>
        ) : numbers.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 rounded-xl border border-dashed border-border">
            <Phone className="h-7 w-7 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No phone numbers added</p>
            <button type="button" onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/30 transition-colors">
              <Plus className="h-4 w-4" /> Add First Number
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {numbers.map((n) => <SmsNumberCard key={n.id} number={n} />)}
          </div>
        )}
      </div>

      {addOpen && <SmsNumberForm onClose={() => setAddOpen(false)} />}
    </div>
  );
}

// ─── WhatsApp components ──────────────────────────────────────────────────────

function WhatsAppSettingsForm({ current }: { current: WhatsAppSettings | null }) {
  const saveMut = useSaveWhatsAppSettings();
  const testMut = useTestWhatsAppSettings();
  const busy = saveMut.isPending;

  const [accessToken, setAccessToken] = useState("");
  const [bizAccountId, setBizAccountId] = useState(current?.business_account_id ?? "");
  const [verifyToken, setVerifyToken] = useState(current?.webhook_verify_token ?? "");

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: WhatsAppSettingsCreate = {
      access_token: accessToken,
      business_account_id: bizAccountId || undefined,
      webhook_verify_token: verifyToken || undefined,
    };
    saveMut.mutate(payload, {
      onSuccess: () => toast.success("WhatsApp settings saved"),
      onError: () => toast.error("Failed to save WhatsApp settings"),
    });
  };

  const handleTest = () => {
    testMut.mutate(undefined, {
      onSuccess: (r) =>
        r.success ? toast.success("WhatsApp connection test passed") : toast.error(`Test failed: ${r.error}`),
      onError: () => toast.error("Test request failed"),
    });
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-semibold text-foreground">WhatsApp Business API</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {current?.token_configured ? "Access token configured" : "No credentials configured"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {current && <HealthBadge status={current.health_status} />}
          {current && (
            <button type="button" onClick={handleTest} disabled={testMut.isPending}
              className="inline-flex items-center gap-1.5 rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-50">
              {testMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
              Test
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <Field label={current?.token_configured ? "Access Token (leave blank to keep)" : "Access Token"} required={!current}>
          <input type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)}
            required={!current} placeholder={current?.token_configured ? "Currently configured" : "EAAxxxxxxx..."}
            className={inputCls} />
        </Field>
        <Field label="Business Account ID">
          <input value={bizAccountId} onChange={(e) => setBizAccountId(e.target.value)}
            placeholder={current?.business_account_id ?? "1234567890"} className={inputCls} />
        </Field>
        <Field label="Webhook Verify Token">
          <input value={verifyToken} onChange={(e) => setVerifyToken(e.target.value)}
            placeholder={current?.webhook_verify_token ?? "my-verify-token"} className={inputCls} />
        </Field>
        <div className="flex justify-end">
          <button type="submit" disabled={busy}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {current ? "Update Credentials" : "Save Credentials"}
          </button>
        </div>
      </form>
    </div>
  );
}

function WaNumberForm({
  existing,
  onClose,
}: {
  existing?: WhatsAppNumber;
  onClose: () => void;
}) {
  const createMut = useCreateWhatsAppNumber();
  const updateMut = useUpdateWhatsAppNumber();
  const busy = createMut.isPending || updateMut.isPending;
  const { data: clientsData } = useClients(1, 100);
  const clients = clientsData?.items ?? [];

  const [form, setForm] = useState<WhatsAppNumberCreate>({
    phone_number_id: existing?.phone_number_id ?? "",
    display_phone_number: existing?.display_phone_number ?? "",
    label: existing?.label ?? "",
    daily_limit: existing?.daily_limit ?? 250,
    client_id: existing?.client_id ?? undefined,
  });
  const set = (k: string, v: string | number | undefined) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      phone_number_id: form.phone_number_id!,
      display_phone_number: form.display_phone_number || undefined,
      label: form.label || undefined,
      daily_limit: Number(form.daily_limit),
      client_id: form.client_id || undefined,
    };
    if (existing) {
      updateMut.mutate(
        { id: existing.id, ...payload },
        {
          onSuccess: () => { toast.success("Number updated"); onClose(); },
          onError: () => toast.error("Failed to update number"),
        }
      );
    } else {
      createMut.mutate(payload, {
        onSuccess: () => { toast.success("Number added"); onClose(); },
        onError: () => toast.error("Failed to add number"),
      });
    }
  };

  return (
    <DialogShell title={existing ? "Edit WA Number" : "Add WA Number"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
        <Field label="Phone Number ID (Meta)" required>
          <input value={form.phone_number_id} onChange={(e) => set("phone_number_id", e.target.value)}
            required placeholder="1234567890" className={inputCls} />
        </Field>
        <Field label="Display Phone Number">
          <input value={form.display_phone_number ?? ""} onChange={(e) => set("display_phone_number", e.target.value)}
            placeholder="+15551234567" className={inputCls} />
        </Field>
        <Field label="Label">
          <input value={form.label ?? ""} onChange={(e) => set("label", e.target.value)}
            placeholder="e.g. US Business Line" className={inputCls} />
        </Field>
        <Field label="Assign to Client" hint="Which client sends WhatsApp from this number">
          <select
            value={form.client_id ?? ""}
            onChange={(e) => set("client_id", e.target.value || undefined)}
            className={inputCls}
          >
            <option value="">— Pool (unassigned) —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Daily Message Limit" required>
          <input type="number" value={form.daily_limit} onChange={(e) => set("daily_limit", e.target.value)}
            required min={1} max={100000} className={inputCls} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={busy}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {existing ? "Save" : "Add Number"}
          </button>
        </div>
      </form>
    </DialogShell>
  );
}

function WaNumberCard({ number }: { number: WhatsAppNumber }) {
  const deleteMut = useDeleteWhatsAppNumber();
  const [editing, setEditing] = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);
  const { data: clientsData } = useClients(1, 100);
  const clients = clientsData?.items ?? [];
  const assignedClient = clients.find((c) => c.id === number.client_id);

  const usePct = number.daily_limit > 0
    ? Math.min(100, Math.round((number.sent_today / number.daily_limit) * 100))
    : 0;

  const handleDelete = () => {
    if (!delConfirm) { setDelConfirm(true); return; }
    deleteMut.mutate(number.id, {
      onSuccess: () => toast.success("Number deleted"),
      onError: () => toast.error("Failed to delete"),
    });
  };

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium text-foreground text-sm">
              {number.display_phone_number ?? number.phone_number_id}
            </p>
            <p className="text-xs text-muted-foreground">
              ID: {number.phone_number_id}{number.label ? ` · ${number.label}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              {assignedClient ? `Client: ${assignedClient.name}` : "Pool (unassigned)"}
            </p>
          </div>
          {!number.is_active && (
            <span className="text-[11px] border border-border bg-muted/20 text-muted-foreground px-2 py-0.5 rounded-full">
              Inactive
            </span>
          )}
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-xs text-muted-foreground">Sent today</span>
            <span className="text-xs font-medium text-foreground">
              {number.sent_today.toLocaleString()} / {number.daily_limit.toLocaleString()}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted/30">
            <div className={cn("h-1.5 rounded-full", usePct >= 90 ? "bg-red-500" : usePct >= 70 ? "bg-amber-500" : "bg-primary")}
              style={{ width: `${usePct}%` }} />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/30 transition-colors">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button type="button" onClick={handleDelete} disabled={deleteMut.isPending}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ml-auto",
              delConfirm
                ? "border-red-500/40 bg-red-500/10 text-red-400"
                : "border-border bg-background text-muted-foreground hover:text-destructive"
            )}>
            {deleteMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            {delConfirm ? "Confirm" : "Delete"}
          </button>
          {delConfirm && (
            <button type="button" onClick={() => setDelConfirm(false)}
              className="text-xs text-muted-foreground hover:text-foreground">
              Cancel
            </button>
          )}
        </div>
      </div>
      {editing && <WaNumberForm existing={number} onClose={() => setEditing(false)} />}
    </>
  );
}

function WhatsAppTab() {
  const [addOpen, setAddOpen] = useState(false);
  const { data: settings, isLoading: settingsLoading } = useWhatsAppSettings();
  const { data: numbers = [], isLoading: numbersLoading } = useWhatsAppNumbers();

  return (
    <div className="space-y-6">
      {settingsLoading ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : (
        <WhatsAppSettingsForm current={settings ?? null} />
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">WhatsApp Phone Numbers</h2>
            <p className="text-sm text-muted-foreground">Registered WhatsApp Business numbers with daily limits.</p>
          </div>
          <button type="button" onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="h-4 w-4" /> Add Number
          </button>
        </div>
        {numbersLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[1, 2].map((n) => <Skeleton key={n} className="h-28 rounded-xl" />)}
          </div>
        ) : numbers.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 rounded-xl border border-dashed border-border">
            <MessageCircle className="h-7 w-7 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No WhatsApp numbers added</p>
            <button type="button" onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/30 transition-colors">
              <Plus className="h-4 w-4" /> Add First Number
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {numbers.map((n) => <WaNumberCard key={n.id} number={n} />)}
          </div>
        )}
      </div>

      {addOpen && <WaNumberForm onClose={() => setAddOpen(false)} />}
    </div>
  );
}

// ─── Tab nav + Main page ──────────────────────────────────────────────────────

type SettingsTab = "smtp" | "ai" | "sms" | "whatsapp";

const TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: "smtp",      label: "SMTP Accounts", icon: <Mail className="h-4 w-4" /> },
  { id: "ai",        label: "AI Models",     icon: <Brain className="h-4 w-4" /> },
  { id: "sms",       label: "SMS",           icon: <Phone className="h-4 w-4" /> },
  { id: "whatsapp",  label: "WhatsApp",      icon: <MessageCircle className="h-4 w-4" /> },
];

export default function SettingsPage() {
  const { isOwner, isLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SettingsTab>("smtp");
  usePageTitle("Settings");

  useEffect(() => {
    if (!isLoading && !isOwner) {
      router.replace("/dashboard");
    }
  }, [isOwner, isLoading, router]);

  if (isLoading || !isOwner) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Platform configuration — visible to owners only.</p>
      </div>

      <div className="flex gap-1 border-b border-border overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setActiveTab(t.id)}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0",
              activeTab === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}>
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "smtp"     && <SmtpTab />}
      {activeTab === "ai"       && <AiModelsTab />}
      {activeTab === "sms"      && <SmsTab />}
      {activeTab === "whatsapp" && <WhatsAppTab />}
    </div>
  );
}

