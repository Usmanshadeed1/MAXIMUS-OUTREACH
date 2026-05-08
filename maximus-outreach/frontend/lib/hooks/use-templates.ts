import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface MessageTemplate {
  id: string;
  client_id: string;
  name: string;
  subject: string | null;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface TemplateCreate {
  name: string;
  subject?: string | null;
  body: string;
}

export interface TemplateUpdate {
  name?: string;
  subject?: string | null;
  body?: string;
}

const key = (clientId: string) => ["templates", clientId];

export function useTemplates(clientId: string) {
  return useQuery({
    queryKey: key(clientId),
    queryFn: async () => {
      const { data } = await api.get<MessageTemplate[]>(`/clients/${clientId}/templates`);
      return data;
    },
    enabled: !!clientId,
    staleTime: 30_000,
  });
}

export function useCreateTemplate(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TemplateCreate) => {
      const { data } = await api.post<MessageTemplate>(`/clients/${clientId}/templates`, payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key(clientId) }),
  });
}

export function useUpdateTemplate(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: TemplateUpdate }) => {
      const { data } = await api.put<MessageTemplate>(`/clients/${clientId}/templates/${id}`, payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key(clientId) }),
  });
}

export function useDeleteTemplate(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/clients/${clientId}/templates/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key(clientId) }),
  });
}
