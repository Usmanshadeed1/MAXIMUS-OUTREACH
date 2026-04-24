import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AssignedClient {
  id: string;
  name: string;
}

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: "owner" | "manager";
  is_active: boolean;
  created_at: string;
  assigned_clients: AssignedClient[];
}

export interface UserList {
  items: AppUser[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface UserCreate {
  email: string;
  password: string;
  name: string;
  role?: string;
  assigned_client_ids?: string[];
}

export interface UserUpdate {
  name?: string;
  email?: string;
  password?: string;
  is_active?: boolean;
  assigned_client_ids?: string[];
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useUsers(page = 1, pageSize = 25) {
  return useQuery({
    queryKey: ["users", page, pageSize],
    queryFn: async () => {
      const { data } = await api.get<UserList>("/users", {
        params: { page, page_size: pageSize },
      });
      return data;
    },
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UserCreate) => {
      const { data } = await api.post<AppUser>("/users", payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UserUpdate & { id: string }) => {
      const { data } = await api.put<AppUser>(`/users/${id}`, payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useDeactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete<AppUser>(`/users/${id}`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}
