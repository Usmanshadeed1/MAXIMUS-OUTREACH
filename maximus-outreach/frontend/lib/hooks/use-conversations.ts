import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MessageResponse {
  id: string;
  conversation_id: string;
  direction: string; // "inbound" | "outbound"
  content: string;
  media_urls: string[];
  is_ai_generated: boolean;
  is_approved: boolean;
  sent_at: string | null;
  created_at: string;
}

export interface ConversationResponse {
  id: string;
  lead_id: string | null;
  client_id: string | null;
  channel: string;
  status: string; // "open" | "closed"
  created_at: string;
  updated_at: string;
  messages: MessageResponse[];
}

export interface ConversationList {
  items: ConversationResponse[];
  total: number;
  page: number;
  page_size: number;
}

// ─── List ─────────────────────────────────────────────────────────────────────

export function useConversations(params?: {
  client_id?: string;
  channel?: string;
  status?: string;
  page?: number;
  page_size?: number;
}) {
  return useQuery({
    queryKey: ["conversations", params],
    queryFn: async () => {
      const { data } = await api.get<ConversationList>("/conversations", {
        params: {
          client_id: params?.client_id || undefined,
          channel:   params?.channel   || undefined,
          status:    params?.status    || undefined,
          page:      params?.page      ?? 1,
          page_size: params?.page_size ?? 25,
        },
      });
      return data;
    },
  });
}

// ─── Single conversation (with thread) ───────────────────────────────────────

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: ["conversations", id],
    queryFn: async () => {
      const { data } = await api.get<ConversationResponse>(`/conversations/${id}`);
      return data;
    },
    enabled: !!id,
    refetchInterval: 15_000,
  });
}

// ─── Manual reply ─────────────────────────────────────────────────────────────

export function useManualReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { data } = await api.post<MessageResponse>(`/conversations/${id}/reply`, { content });
      return data;
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ["conversations", id] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

// ─── Close conversation ───────────────────────────────────────────────────────

export function useCloseConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<ConversationResponse>(`/conversations/${id}/close`);
      return data;
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["conversations", id] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}
