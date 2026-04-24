import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Lead, LeadImport, PaginatedResponse } from "@/types";

export interface LeadFilters {
  page?: number;
  page_size?: number;
  status?: string;
  has_email?: boolean;
  has_phone?: boolean;
  has_social?: boolean;
  search?: string;
}

export function useLeads(clientId: string, filters: LeadFilters = {}) {
  return useQuery({
    queryKey: ["leads", clientId, filters],
    queryFn: async () => {
      const params: Record<string, string | number | boolean> = {
        page: filters.page ?? 1,
        page_size: filters.page_size ?? 25,
      };
      if (filters.status) params.status = filters.status;
      if (filters.has_email !== undefined) params.has_email = filters.has_email;
      if (filters.has_phone !== undefined) params.has_phone = filters.has_phone;
      if (filters.has_social !== undefined) params.has_social = filters.has_social;
      if (filters.search) params.search = filters.search;

      const { data } = await api.get<PaginatedResponse<Lead>>(
        `/clients/${clientId}/leads`,
        { params }
      );
      return data;
    },
    enabled: !!clientId,
    placeholderData: (prev) => prev,
  });
}

export function useUpdateLead(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, payload }: { leadId: string; payload: Partial<Lead> }) => {
      const { data } = await api.patch<Lead>(`/clients/${clientId}/leads/${leadId}`, payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads", clientId] }),
  });
}

export function useBulkStatus(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadIds, status }: { leadIds: string[]; status: string }) => {
      const { data } = await api.patch(`/clients/${clientId}/leads/bulk-status`, {
        lead_ids: leadIds,
        status,
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads", clientId] }),
  });
}

export function useBulkDelete(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (leadIds: string[]) => {
      const { data } = await api.delete(`/clients/${clientId}/leads/bulk`, {
        data: { lead_ids: leadIds },
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads", clientId] }),
  });
}

export function useImportHistory(clientId: string) {
  return useQuery({
    queryKey: ["leads", clientId, "import-history"],
    queryFn: async () => {
      const { data } = await api.get<LeadImport[]>(
        `/clients/${clientId}/leads/import-history`
      );
      return data;
    },
    enabled: !!clientId,
  });
}

export function useImportLeads(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post<LeadImport>(
        `/clients/${clientId}/leads/import`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads", clientId] });
      qc.invalidateQueries({ queryKey: ["clients", clientId] });
    },
  });
}
