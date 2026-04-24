import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AiProvider = "openrouter" | "groq";

export interface AiKey {
  id: string;
  provider: AiProvider;
  base_url: string;
  model_name: string;
  label: string | null;
  priority: number;
  daily_limit: number;
  requests_today: number;
  is_active: boolean;
  health_status: string; // "healthy" | "failing" | "untested"
  last_health_check: string | null;
  last_error: string | null;
  created_at: string;
  api_key_masked: string;
}

export interface AiKeyCreate {
  provider: AiProvider;
  base_url: string;
  api_key: string;
  model_name: string;
  label?: string;
  priority?: number;
  daily_limit?: number;
}

export interface AiKeyUpdate {
  provider?: AiProvider;
  base_url?: string;
  api_key?: string;
  model_name?: string;
  label?: string;
  priority?: number;
  daily_limit?: number;
  is_active?: boolean;
}

export interface AiKeyTestResult {
  success: boolean;
  provider: string;
  model_name: string;
  response_text: string | null;
  error: string | null;
  latency_ms: number | null;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

const QK = ["settings", "ai-keys"];

export function useAiKeys() {
  return useQuery({
    queryKey: QK,
    queryFn: async () => {
      const { data } = await api.get<AiKey[]>("/settings/ai-keys");
      return data;
    },
  });
}

export function useCreateAiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AiKeyCreate) => {
      const { data } = await api.post<AiKey>("/settings/ai-keys", payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useUpdateAiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: AiKeyUpdate & { id: string }) => {
      const { data } = await api.put<AiKey>(`/settings/ai-keys/${id}`, payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useDeleteAiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/settings/ai-keys/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useTestAiKey() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<AiKeyTestResult>(`/settings/ai-keys/${id}/test`);
      return data;
    },
  });
}
