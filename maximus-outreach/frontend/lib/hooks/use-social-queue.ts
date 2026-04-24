import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { SocialDmQueueItem } from "@/types";

export interface SocialDmStats {
  pending: number;
  sent_today: number;
  skipped: number;
}

interface ListParams {
  platform?: string;
  client_id?: string;
  status?: string;
  page?: number;
  page_size?: number;
}

export function useSocialQueue(params: ListParams = {}) {
  return useQuery({
    queryKey: ["social-queue", params],
    queryFn: async () => {
      const { data } = await api.get<SocialDmQueueItem[]>("/social-queue", { params });
      return data;
    },
  });
}

export function useSocialQueueStats(clientId?: string) {
  return useQuery({
    queryKey: ["social-queue-stats", clientId],
    queryFn: async () => {
      const { data } = await api.get<SocialDmStats>("/social-queue/stats", {
        params: clientId ? { client_id: clientId } : {},
      });
      return data;
    },
    refetchInterval: 30_000,
  });
}

export function useMarkSent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dmId: string) => {
      const { data } = await api.patch<SocialDmQueueItem>(`/social-queue/${dmId}/mark-sent`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social-queue"] });
      qc.invalidateQueries({ queryKey: ["social-queue-stats"] });
    },
  });
}

export function useSkipDm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dmId: string) => {
      const { data } = await api.patch<SocialDmQueueItem>(`/social-queue/${dmId}/skip`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social-queue"] });
      qc.invalidateQueries({ queryKey: ["social-queue-stats"] });
    },
  });
}
