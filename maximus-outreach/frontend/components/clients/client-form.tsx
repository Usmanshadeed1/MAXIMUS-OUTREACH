"use client";

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useCreateClient, useUpdateClient } from "@/lib/hooks/use-clients";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Megaphone,
  MessageSquare,
  Mail,
  ChevronLeft,
  Loader2,
  AlertCircle,
  Check,
} from "lucide-react";
import Link from "next/link";
import type { Client } from "@/types";

// ─── Schema ──────────────────────────────────────────────────────────────────

const clientSchema = z.object({
  name: z.string().min(1, "Client name is required").max(200),
  business_type: z.string().max(100).optional().or(z.literal("")),
  website: z
    .string()
    .max(500)
    .optional()
    .or(z.literal(""))
    .refine(
      (v) => !v || /^https?:\/\/.+/.test(v),
      "Website must start with http:// or https://"
    ),
  phone: z.string().max(30).optional().or(z.literal("")),
  services: z.string().max(2000).optional().or(z.literal("")),
  target_audience: z.string().max(1000).optional().or(z.literal("")),
  pitch: z.string().max(2000).optional().or(z.literal("")),
  tone: z.enum(["professional", "friendly", "casual", "bold", "empathetic"]),
  custom_instructions: z.string().max(4000).optional().or(z.literal("")),
  from_email: z
    .string()
    .max(255)
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Invalid email address"),
  from_name: z.string().max(100).optional().or(z.literal("")),
});

type ClientFormValues = z.infer<typeof clientSchema>;

const TONES = [
  { value: "professional", label: "Professional", desc: "Formal, polished, business-focused" },
  { value: "friendly", label: "Friendly", desc: "Warm, approachable, personable" },
  { value: "casual", label: "Casual", desc: "Relaxed, conversational, informal" },
  { value: "bold", label: "Bold", desc: "Direct, confident, assertive" },
  { value: "empathetic", label: "Empathetic", desc: "Understanding, compassionate, supportive" },
] as const;

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Section header */}
      <div className="flex items-start gap-4 px-6 py-4 border-b border-border bg-muted/30">
        <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
          <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      {/* Fields */}
      <div className="p-6 space-y-5">{children}</div>
    </div>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {children}
      {hint && !error && (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      )}
      {error && (
        <p className="flex items-center gap-1 text-[11px] text-destructive" role="alert">
          <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ClientFormProps {
  mode: "create" | "edit";
  client?: Client;
}

export function ClientForm({ mode, client }: ClientFormProps) {
  const router = useRouter();
  const createClient = useCreateClient();
  const updateClient = useUpdateClient(client?.id ?? "");

  const defaultValues: ClientFormValues = {
    name: client?.name ?? "",
    business_type: client?.business_type ?? "",
    website: client?.website ?? "",
    phone: client?.phone ?? "",
    services: client?.services ?? "",
    target_audience: client?.target_audience ?? "",
    pitch: client?.pitch ?? "",
    tone: (client?.tone as ClientFormValues["tone"]) ?? "professional",
    custom_instructions: client?.custom_instructions ?? "",
    from_email: client?.from_email ?? "",
    from_name: client?.from_name ?? "",
  };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues,
  });

  const selectedTone = watch("tone");

  // Unsaved changes confirmation
  const handleBeforeUnload = useCallback(
    (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
      }
    },
    [isDirty]
  );

  useEffect(() => {
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [handleBeforeUnload]);

  // Clean empty strings → undefined for backend
  function clean(v: string | undefined) {
    return v?.trim() || undefined;
  }

  async function onSubmit(values: ClientFormValues) {
    const payload = {
      name: values.name.trim(),
      business_type: clean(values.business_type),
      website: clean(values.website),
      phone: clean(values.phone),
      services: clean(values.services),
      target_audience: clean(values.target_audience),
      pitch: clean(values.pitch),
      tone: values.tone,
      custom_instructions: clean(values.custom_instructions),
      from_email: clean(values.from_email),
      from_name: clean(values.from_name),
    };

    try {
      if (mode === "create") {
        const created = await createClient.mutateAsync(payload);
        toast.success("Client created successfully");
        router.push(`/clients/${created.id}`);
      } else {
        await updateClient.mutateAsync(payload);
        toast.success("Client updated successfully");
        router.push(`/clients/${client!.id}`);
      }
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(detail ?? "Something went wrong. Please try again.");
    }
  }

  const isEdit = mode === "edit";
  const pageTitle = isEdit ? `Edit: ${client?.name}` : "Create New Client";

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      {/* Page header */}
      <div>
        <Link
          href="/clients"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "gap-1.5 -ml-2 mb-3 text-muted-foreground"
          )}
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Clients
        </Link>
        <h1 className="text-2xl font-bold text-foreground">{pageTitle}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isEdit
            ? "Update this client's profile and AI outreach configuration."
            : "Set up a new client with their business details and outreach preferences."}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        {/* ── Section 1: Basic Info ── */}
        <Section
          icon={Building2}
          title="Basic Information"
          description="Core details about the client's business"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field
              label="Client Name"
              htmlFor="name"
              error={errors.name?.message}
              required
            >
              <Input
                id="name"
                placeholder="e.g. Maximus Kitchens"
                aria-invalid={!!errors.name}
                className={cn(errors.name && "border-destructive")}
                {...register("name")}
              />
            </Field>

            <Field
              label="Business Type"
              htmlFor="business_type"
              error={errors.business_type?.message}
              hint="e.g. Kitchen Remodeling, SaaS, Construction"
            >
              <Input
                id="business_type"
                placeholder="e.g. Kitchen Remodeling"
                {...register("business_type")}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field
              label="Website"
              htmlFor="website"
              error={errors.website?.message}
            >
              <Input
                id="website"
                type="url"
                placeholder="https://example.com"
                aria-invalid={!!errors.website}
                className={cn(errors.website && "border-destructive")}
                {...register("website")}
              />
            </Field>

            <Field
              label="Phone"
              htmlFor="phone"
              error={errors.phone?.message}
            >
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 000-0000"
                {...register("phone")}
              />
            </Field>
          </div>
        </Section>

        {/* ── Section 2: Services & Pitch ── */}
        <Section
          icon={Megaphone}
          title="Services & Pitch"
          description="Used by AI to write personalized outreach messages"
        >
          <Field
            label="Services Offered"
            htmlFor="services"
            error={errors.services?.message}
            hint="Describe what this client does and sells"
          >
            <Textarea
              id="services"
              rows={3}
              placeholder="e.g. Custom kitchen cabinet installation, countertop replacement, full kitchen remodels for residential and commercial properties."
              className="resize-none"
              {...register("services")}
            />
          </Field>

          <Field
            label="Target Audience"
            htmlFor="target_audience"
            error={errors.target_audience?.message}
            hint="Who are they trying to reach?"
          >
            <Textarea
              id="target_audience"
              rows={2}
              placeholder="e.g. Homeowners aged 35–60 planning a kitchen renovation, real estate investors, property managers."
              className="resize-none"
              {...register("target_audience")}
            />
          </Field>

          <Field
            label="Value Pitch"
            htmlFor="pitch"
            error={errors.pitch?.message}
            hint="Key selling points — what makes them stand out?"
          >
            <Textarea
              id="pitch"
              rows={3}
              placeholder="e.g. 15 years in business, licensed & insured, free estimates, 3-year warranty on all work, 4.9★ rating with 200+ reviews."
              className="resize-none"
              {...register("pitch")}
            />
          </Field>
        </Section>

        {/* ── Section 3: Communication ── */}
        <Section
          icon={MessageSquare}
          title="Communication Style"
          description="Sets the AI's tone for all outreach messages"
        >
          {/* Tone selector */}
          <Field label="Outreach Tone" htmlFor="tone" error={errors.tone?.message} required>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1" role="radiogroup" aria-labelledby="tone-label">
              {TONES.map((t) => {
                const active = selectedTone === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setValue("tone", t.value, { shouldDirty: true })}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border px-4 py-3 text-left transition-all",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "border-primary bg-primary/8 text-foreground"
                        : "border-border bg-background hover:border-border/80 hover:bg-muted/30 text-muted-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                        active ? "border-primary bg-primary" : "border-border"
                      )}
                    >
                      {active && <Check className="h-2.5 w-2.5 text-primary-foreground" aria-hidden="true" />}
                    </span>
                    <span>
                      <span className={cn("text-sm font-medium block", active && "text-foreground")}>
                        {t.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground mt-0.5 block leading-snug">
                        {t.desc}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            {/* Hidden input to register with RHF */}
            <input type="hidden" {...register("tone")} />
          </Field>

          <Field
            label="Custom AI Instructions"
            htmlFor="custom_instructions"
            error={errors.custom_instructions?.message}
            hint="Optional extra instructions appended to every AI prompt for this client"
          >
            <Textarea
              id="custom_instructions"
              rows={3}
              placeholder="e.g. Always mention the free estimate offer. Never mention competitor brands. Focus on the quality of materials used."
              className="resize-none"
              {...register("custom_instructions")}
            />
          </Field>
        </Section>

        {/* ── Section 4: Email Configuration ── */}
        <Section
          icon={Mail}
          title="Email Configuration"
          description="Displayed as the sender name and address in outbound emails"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field
              label="From Email"
              htmlFor="from_email"
              error={errors.from_email?.message}
              hint="Override the SMTP account's default sender"
            >
              <Input
                id="from_email"
                type="email"
                placeholder="hello@maximus-kitchens.com"
                aria-invalid={!!errors.from_email}
                className={cn(errors.from_email && "border-destructive")}
                {...register("from_email")}
              />
            </Field>

            <Field
              label="From Name"
              htmlFor="from_name"
              error={errors.from_name?.message}
              hint='Displayed as sender e.g. "Maximus Kitchens"'
            >
              <Input
                id="from_name"
                placeholder="Maximus Kitchens"
                {...register("from_name")}
              />
            </Field>
          </div>
        </Section>

        {/* ── Actions ── */}
        <div className="flex items-center gap-3 justify-end pt-2">
          {isDirty && (
            <Badge variant="secondary" className="text-xs text-muted-foreground gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 inline-block" aria-hidden="true" />
              Unsaved changes
            </Badge>
          )}
          <Link
            href="/clients"
            className={cn(buttonVariants({ variant: "ghost" }), "text-muted-foreground")}
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              buttonVariants({ variant: "default" }),
              "min-w-[130px] gap-2"
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {isEdit ? "Saving…" : "Creating…"}
              </>
            ) : isEdit ? (
              "Save Changes"
            ) : (
              "Create Client"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
