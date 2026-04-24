import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ClientStore {
  selectedClientId: string | null;
  setSelectedClientId: (id: string) => void;
  clearSelectedClient: () => void;
}

export const useClientStore = create<ClientStore>()(
  persist(
    (set) => ({
      selectedClientId: null,
      setSelectedClientId: (id) => set({ selectedClientId: id }),
      clearSelectedClient: () => set({ selectedClientId: null }),
    }),
    {
      name: "maximus-selected-client",
    }
  )
);
