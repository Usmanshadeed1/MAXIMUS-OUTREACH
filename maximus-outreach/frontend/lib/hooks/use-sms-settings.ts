import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SmsProvider = "twilio" | "telnyx";

export interface SmsSetting {
  id: string;
  provider: SmsProvider;
  twilio_account_sid: string | null;
  telnyx_configured: boolean;
  telnyx_webhook_configured: boolean;
  is_active: boolean;
  health_status: string;
  created_at: string;
}

export interface SmsSettingCreate {
  provider: SmsProvider;
  twilio_account_sid?: string;
  twilio_auth_token?: string;
  telnyx_api_key?: string;
  telnyx_webhook_public_key?: string;
}

export interface SmsTestResult {
  success: boolean;
  provider: string;
  error: string | null;
}

export interface SmsNumber {
  id: string;
  phone_number: string;
  label: string | null;
  client_id: string | null;
  daily_limit: number;
  sent_today: number;
  is_active: boolean;
  created_at: string;
}

export interface SmsNumberCreate {
  phone_number: string;
  label?: string;
  client_id?: string;
  daily_limit?: number;
  is_active?: boolean;
}

export interface SmsNumberUpdate {
  label?: string;
  client_id?: string;
  daily_limit?: number;
  is_active?: boolean;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

const PROVIDER_QK = ["settings", "sms-provider"];
const NUMBERS_QK = ["settings", "sms-numbers"];

export function useSmsSetting() {
  return useQuery({
    queryKey: PROVIDER_QK,
    queryFn: async () => {
      const { data } = await api.get<SmsSetting | null>("/settings/sms");
      return data ?? null;
    },
  });
}

export function useSaveSmsSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SmsSettingCreate) => {
      const { data } = await api.post<SmsSetting>("/settings/sms", payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PROVIDER_QK }),
  });
}

export function useTestSmsSetting() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<SmsTestResult>("/settings/sms/test");
      return data;
    },
  });
}

export function useSmsNumbers() {
  return useQuery({
    queryKey: NUMBERS_QK,
    queryFn: async () => {
      const { data } = await api.get<SmsNumber[]>("/settings/sms/numbers");
      return data;
    },
  });
}

export function useCreateSmsNumber() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SmsNumberCreate) => {
      const { data } = await api.post<SmsNumber>("/settings/sms/numbers", payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: NUMBERS_QK }),
  });
}

export function useUpdateSmsNumber() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: SmsNumberUpdate & { id: string }) => {
      const { data } = await api.put<SmsNumber>(`/settings/sms/numbers/${id}`, payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: NUMBERS_QK }),
  });
}

export function useDeleteSmsNumber() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/settings/sms/numbers/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: NUMBERS_QK }),
  });
}
