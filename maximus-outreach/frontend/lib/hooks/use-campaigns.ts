import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Campaign, CampaignStep } from "@/types";

// ─── List shape from backend ──────────────────────────────────────────────────

export interface CampaignListResponse {
  items: Campaign[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface PacingStatus {
  campaign_id: string;
  campaign_name: string;
  pacing_mode: string;
  total_enrolled: number;
  total_activated: number;
  total_queued: number;
  leads_per_day_config: Record<string, number>;
}

// ─── Create/update payloads ───────────────────────────────────────────────────

export interface CampaignCreatePayload {
  name: string;
  description?: string;
  stop_on_reply?: boolean;
  max_attempts?: number;
  repeat_delay_days?: number;
  pacing_mode?: string;
  pacing_leads_per_day?: Record<string, number>;
  send_window_start?: string;
  send_window_end?: string;
  send_timezone?: string;
  steps?: StepCreatePayload[];
}

export interface CampaignUpdatePayload extends Omit<CampaignCreatePayload, "steps"> {}

export interface StepCreatePayload {
  step_order: number;
  channel: string;
  delay_days?: number;
  delay_hours?: number;
  message_template?: string;
  use_ai_generation?: boolean;
  ai_prompt_override?: string;
  subject_template?: string;
}

export interface StepUpdatePayload extends Partial<StepCreatePayload> {
  is_active?: boolean;
}

export interface EnrollPayload {
  lead_ids?: string[];
  filter_status?: string;
}

export interface EnrollResult {
  enrolled: number;
  skipped_already_enrolled: number;
  skipped_not_found: number;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useCampaigns(clientId: string, page = 1, pageSize = 25) {
  return useQuery({
    queryKey: ["campaigns", clientId, page, pageSize],
    queryFn: async () => {
      const { data } = await api.get<CampaignListResponse>(
        `/clients/${clientId}/campaigns`,
        { params: { page, page_size: pageSize } }
      );
      return data;
    },
    enabled: !!clientId,
    placeholderData: (prev) => prev,
  });
}

export function useCampaign(campaignId: string) {
  return useQuery({
    queryKey: ["campaign", campaignId],
    queryFn: async () => {
      const { data } = await api.get<Campaign>(`/campaigns/${campaignId}`);
      return data;
    },
    enabled: !!campaignId,
  });
}

export function useCreateCampaign(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CampaignCreatePayload) => {
      const { data } = await api.post<Campaign>(
        `/clients/${clientId}/campaigns`,
        payload
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns", clientId] });
      qc.invalidateQueries({ queryKey: ["clients", clientId] });
    },
  });
}

export function useUpdateCampaign(campaignId: string, clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CampaignUpdatePayload) => {
      const { data } = await api.put<Campaign>(`/campaigns/${campaignId}`, payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign", campaignId] });
      qc.invalidateQueries({ queryKey: ["campaigns", clientId] });
    },
  });
}

export function useDeleteCampaign(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (campaignId: string) => {
      await api.delete(`/campaigns/${campaignId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns", clientId] });
      qc.invalidateQueries({ queryKey: ["clients", clientId] });
    },
  });
}

export function useStartCampaign(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (campaignId: string) => {
      const { data } = await api.post<Campaign>(`/campaigns/${campaignId}/start`);
      return data;
    },
    onSuccess: (_, campaignId) => {
      qc.invalidateQueries({ queryKey: ["campaign", campaignId] });
      qc.invalidateQueries({ queryKey: ["campaigns", clientId] });
    },
  });
}

export function usePauseCampaign(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (campaignId: string) => {
      const { data } = await api.post<Campaign>(`/campaigns/${campaignId}/pause`);
      return data;
    },
    onSuccess: (_, campaignId) => {
      qc.invalidateQueries({ queryKey: ["campaign", campaignId] });
      qc.invalidateQueries({ queryKey: ["campaigns", clientId] });
    },
  });
}

export function useResumeCampaign(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (campaignId: string) => {
      const { data } = await api.post<Campaign>(`/campaigns/${campaignId}/resume`);
      return data;
    },
    onSuccess: (_, campaignId) => {
      qc.invalidateQueries({ queryKey: ["campaign", campaignId] });
      qc.invalidateQueries({ queryKey: ["campaigns", clientId] });
    },
  });
}

export function useAddStep(campaignId: string, clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: StepCreatePayload) => {
      const { data } = await api.post<CampaignStep>(
        `/campaigns/${campaignId}/steps`,
        payload
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign", campaignId] });
      qc.invalidateQueries({ queryKey: ["campaigns", clientId] });
    },
  });
}

export function useUpdateStep(campaignId: string, clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ stepId, payload }: { stepId: string; payload: StepUpdatePayload }) => {
      const { data } = await api.put<CampaignStep>(
        `/campaigns/${campaignId}/steps/${stepId}`,
        payload
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign", campaignId] });
      qc.invalidateQueries({ queryKey: ["campaigns", clientId] });
    },
  });
}

export function useDeleteStep(campaignId: string, clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (stepId: string) => {
      await api.delete(`/campaigns/${campaignId}/steps/${stepId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign", campaignId] });
      qc.invalidateQueries({ queryKey: ["campaigns", clientId] });
    },
  });
}

export function useEnrollLeads(campaignId: string, clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: EnrollPayload) => {
      const { data } = await api.post<EnrollResult>(
        `/campaigns/${campaignId}/enroll`,
        payload
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign", campaignId] });
      qc.invalidateQueries({ queryKey: ["campaigns", clientId] });
    },
  });
}

export function usePacingStatus(campaignId: string) {
  return useQuery({
    queryKey: ["campaign-pacing", campaignId],
    queryFn: async () => {
      const { data } = await api.get<PacingStatus>(`/campaigns/${campaignId}/pacing`);
      return data;
    },
    enabled: !!campaignId,
    refetchInterval: 60_000, // refresh every minute when viewed
  });
}

// ─── Outreach log types ───────────────────────────────────────────────────────

export interface OutreachLogEntry {
  id: string;
  lead_id: string | null;
  lead_name: string;
  channel: string;
  status: string;
  subject: string | null;
  message_content: string | null;
  error_message: string | null;
  ai_model_used: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  created_at: string;
}

export interface OutreachLogList {
  items: OutreachLogEntry[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export function useCampaignLogs(
  campaignId: string,
  filters: { channel?: string; status?: string; page?: number }
) {
  return useQuery({
    queryKey: ["campaign-logs", campaignId, filters],
    queryFn: async () => {
      const params: Record<string, string | number> = { page: filters.page ?? 1, page_size: 50 };
      if (filters.channel) params.channel = filters.channel;
      if (filters.status) params.status = filters.status;
      const { data } = await api.get<OutreachLogList>(`/campaigns/${campaignId}/logs`, { params });
      return data;
    },
    enabled: !!campaignId,
    refetchInterval: 30_000,
  });
}
