import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReviewQueueItem {
  id: string;
  conversation_id: string;
  lead_id: string | null;
  client_id: string | null;
  channel: string;
  content: string;
  is_ai_generated: boolean;
  created_at: string;
}

export interface ReviewQueueList {
  items: ReviewQueueItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface ReviewQueueCount {
  count: number;
}

export interface MessageResponse {
  id: string;
  conversation_id: string;
  direction: string;
  content: string;
  media_urls: string[];
  is_ai_generated: boolean;
  is_approved: boolean;
  sent_at: string | null;
  created_at: string;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useReviewQueue(params?: {
  client_id?: string;
  page?: number;
  page_size?: number;
}) {
  return useQuery({
    queryKey: ["review-queue", params],
    queryFn: async () => {
      const { data } = await api.get<ReviewQueueList>("/review-queue", {
        params: {
          client_id: params?.client_id || undefined,
          page: params?.page ?? 1,
          page_size: params?.page_size ?? 50,
        },
      });
      return data;
    },
    refetchInterval: 30_000,
  });
}

export function useReviewQueueCount(clientId?: string) {
  return useQuery({
    queryKey: ["review-queue-count", clientId],
    queryFn: async () => {
      const { data } = await api.get<ReviewQueueCount>("/review-queue/count", {
        params: { client_id: clientId || undefined },
      });
      return data;
    },
    refetchInterval: 30_000,
  });
}

export function useApproveDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (messageId: string) => {
      const { data } = await api.post<MessageResponse>(`/review-queue/${messageId}/approve`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["review-queue"] });
      qc.invalidateQueries({ queryKey: ["review-queue-count"] });
    },
  });
}

export function useEditDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { data } = await api.post<MessageResponse>(`/review-queue/${id}/edit`, { content });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["review-queue"] });
      qc.invalidateQueries({ queryKey: ["review-queue-count"] });
    },
  });
}

export function useDiscardDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (messageId: string) => {
      await api.post(`/review-queue/${messageId}/discard`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["review-queue"] });
      qc.invalidateQueries({ queryKey: ["review-queue-count"] });
    },
  });
}
