import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface DashboardStats {
  total_leads: number;
  total_sent: number;
  total_replies: number;
  reply_rate: number;
  total_customers: number;
  conversion_rate: number;
  sent_by_channel: Record<string, number>;
  messages_over_time: { date: string; sent: number }[];
  channel_performance: {
    channel: string;
    sent: number;
    replies: number;
    reply_rate: number;
    total_cost: number;
  }[];
  lead_pipeline: { status: string; count: number }[];
  top_campaigns: {
    id: string;
    name: string;
    status: string;
    total_enrolled: number;
    total_activated: number;
    sent: number;
    replies: number;
    reply_rate: number;
  }[];
  cost_estimates: Record<string, number>;
}

export interface AnalyticsParams {
  client_id?: string;
  date_from?: string;
  date_to?: string;
}

export function useDashboardStats(params?: AnalyticsParams) {
  return useQuery({
    queryKey: ["analytics", "dashboard", params],
    queryFn: async () => {
      const { data } = await api.get<DashboardStats>("/analytics/dashboard", {
        params: {
          client_id: params?.client_id || undefined,
          date_from: params?.date_from || undefined,
          date_to:   params?.date_to   || undefined,
        },
      });
      return data;
    },
    staleTime: 60_000,
  });
}

export function useClientAnalytics(clientId: string | null) {
  return useQuery({
    queryKey: ["analytics", "client", clientId],
    queryFn: async () => {
      const { data } = await api.get<DashboardStats>("/analytics/dashboard", {
        params: { client_id: clientId },
      });
      return data;
    },
    enabled: !!clientId,
    staleTime: 60_000,
  });
}

export async function exportAnalytics(params: {
  client_id: string;
  format?: "csv" | "json";
  date_from?: string;
  date_to?: string;
}) {
  const response = await api.get("/analytics/export", {
    params: {
      client_id: params.client_id,
      format: params.format ?? "csv",
      date_from: params.date_from || undefined,
      date_to:   params.date_to   || undefined,
    },
    responseType: "blob",
  });
  const url = URL.createObjectURL(response.data as Blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `analytics.${params.format ?? "csv"}`;
  a.click();
  URL.revokeObjectURL(url);
}
