import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SmtpAccount {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  from_email: string | null;
  from_name: string | null;
  use_tls: boolean;
  is_default: boolean;
  daily_limit: number;
  sent_today: number;
  warmup_enabled: boolean;
  warmup_start_date: string | null;
  warmup_current_daily_limit: number;
  is_active: boolean;
  health_status: string; // "healthy" | "failing" | "untested"
  last_health_check: string | null;
  created_at: string;
}

export interface SmtpCreate {
  name: string;
  host: string;
  port: number;
  username: string;
  password: string;
  from_email?: string;
  from_name?: string;
  use_tls?: boolean;
  is_default?: boolean;
  daily_limit?: number;
  warmup_enabled?: boolean;
}

export interface SmtpUpdate extends Partial<SmtpCreate> {
  is_active?: boolean;
}

export interface SmtpTestResult {
  success: boolean;
  error: string | null;
  latency_ms: number | null;
}

export interface WarmupStartResult {
  smtp_id: string;
  warmup_start_date: string;
  schedule: { day_number: number; daily_limit: number }[];
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

const QK = ["settings", "smtp"];

export function useSmtpAccounts() {
  return useQuery({
    queryKey: QK,
    queryFn: async () => {
      const { data } = await api.get<SmtpAccount[]>("/settings/smtp");
      return data;
    },
  });
}

export function useCreateSmtp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SmtpCreate) => {
      const { data } = await api.post<SmtpAccount>("/settings/smtp", payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useUpdateSmtp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: SmtpUpdate & { id: string }) => {
      const { data } = await api.put<SmtpAccount>(`/settings/smtp/${id}`, payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useDeleteSmtp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/settings/smtp/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useTestSmtp() {
  return useMutation({
    mutationFn: async ({ id, to_email }: { id: string; to_email: string }) => {
      const { data } = await api.post<SmtpTestResult>(`/settings/smtp/${id}/test`, {
        to_email,
        subject: "Maximus Outreach - SMTP Test",
      });
      return data;
    },
  });
}

export function useStartWarmup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<WarmupStartResult>(`/settings/smtp/${id}/warmup/start`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}
