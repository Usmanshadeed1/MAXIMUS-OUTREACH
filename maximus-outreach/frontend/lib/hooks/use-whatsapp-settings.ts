import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WhatsAppSettings {
  id: string;
  business_account_id: string | null;
  webhook_verify_token: string | null;
  token_configured: boolean;
  is_active: boolean;
  health_status: string;
  created_at: string;
}

export interface WhatsAppSettingsCreate {
  access_token: string;
  business_account_id?: string;
  webhook_verify_token?: string;
}

export interface WhatsAppTestResult {
  success: boolean;
  error: string | null;
}

export interface WhatsAppNumber {
  id: string;
  phone_number_id: string;
  display_phone_number: string | null;
  label: string | null;
  client_id: string | null;
  daily_limit: number;
  sent_today: number;
  is_active: boolean;
  created_at: string;
}

export interface WhatsAppNumberCreate {
  phone_number_id: string;
  display_phone_number?: string;
  label?: string;
  client_id?: string;
  daily_limit?: number;
}

export interface WhatsAppNumberUpdate {
  display_phone_number?: string;
  label?: string;
  client_id?: string;
  daily_limit?: number;
  is_active?: boolean;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

const SETTINGS_QK = ["settings", "whatsapp"];
const NUMBERS_QK = ["settings", "whatsapp-numbers"];

export function useWhatsAppSettings() {
  return useQuery({
    queryKey: SETTINGS_QK,
    queryFn: async () => {
      const { data } = await api.get<WhatsAppSettings | null>("/settings/whatsapp");
      return data ?? null;
    },
  });
}

export function useSaveWhatsAppSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: WhatsAppSettingsCreate) => {
      const { data } = await api.post<WhatsAppSettings>("/settings/whatsapp", payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SETTINGS_QK }),
  });
}

export function useTestWhatsAppSettings() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<WhatsAppTestResult>("/settings/whatsapp/test");
      return data;
    },
  });
}

export function useWhatsAppNumbers() {
  return useQuery({
    queryKey: NUMBERS_QK,
    queryFn: async () => {
      const { data } = await api.get<WhatsAppNumber[]>("/settings/whatsapp/numbers");
      return data;
    },
  });
}

export function useCreateWhatsAppNumber() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: WhatsAppNumberCreate) => {
      const { data } = await api.post<WhatsAppNumber>("/settings/whatsapp/numbers", payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: NUMBERS_QK }),
  });
}

export function useUpdateWhatsAppNumber() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: WhatsAppNumberUpdate & { id: string }) => {
      const { data } = await api.put<WhatsAppNumber>(`/settings/whatsapp/numbers/${id}`, payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: NUMBERS_QK }),
  });
}

export function useDeleteWhatsAppNumber() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/settings/whatsapp/numbers/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: NUMBERS_QK }),
  });
}
