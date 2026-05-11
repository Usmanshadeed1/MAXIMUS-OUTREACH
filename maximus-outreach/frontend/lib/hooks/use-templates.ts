import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface MessageTemplate {
  id: string;
  client_id: string | null;
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

// ─── Client templates ────────────────────────────────────────────────────────

const clientKey = (clientId: string) => ["templates", "client", clientId];

export function useTemplates(clientId: string) {
  return useQuery({
    queryKey: clientKey(clientId),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: clientKey(clientId) }),
  });
}

export function useUpdateTemplate(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: TemplateUpdate }) => {
      const { data } = await api.put<MessageTemplate>(`/clients/${clientId}/templates/${id}`, payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: clientKey(clientId) }),
  });
}

export function useDeleteTemplate(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/clients/${clientId}/templates/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: clientKey(clientId) }),
  });
}

// ─── Global templates ────────────────────────────────────────────────────────

const globalKey = () => ["templates", "global"];

export function useGlobalTemplates() {
  return useQuery({
    queryKey: globalKey(),
    queryFn: async () => {
      const { data } = await api.get<MessageTemplate[]>("/templates");
      return data;
    },
    staleTime: 30_000,
  });
}

export function useCreateGlobalTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TemplateCreate) => {
      const { data } = await api.post<MessageTemplate>("/templates", payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: globalKey() }),
  });
}

export function useUpdateGlobalTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: TemplateUpdate }) => {
      const { data } = await api.put<MessageTemplate>(`/templates/${id}`, payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: globalKey() }),
  });
}

export function useDeleteGlobalTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/templates/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: globalKey() }),
  });
}

export function useMakeGlobalTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tpl: Pick<MessageTemplate, "name" | "subject" | "body">) => {
      const { data } = await api.post<MessageTemplate>("/templates", {
        name: tpl.name,
        subject: tpl.subject,
        body: tpl.body,
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: globalKey() }),
  });
}
