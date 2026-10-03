import { create } from "zustand";
import { persist } from "zustand/middleware";

type UiState = {
  sidebarCollapsed: boolean;
  chatSearch: string;
  toggleSidebar: () => void;
  setSidebarCollapsed: (value: boolean) => void;
  setChatSearch: (value: string) => void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      chatSearch: "",
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setChatSearch: (chatSearch) => set({ chatSearch }),
    }),
    { name: "voyagemesh-ui" },
  ),
);
