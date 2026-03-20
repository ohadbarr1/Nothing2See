import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SupportedRegion } from "@nothing2see/types";

export interface AppState {
  region: SupportedRegion;
  selectedServices: string[];
  setRegion: (region: SupportedRegion) => void;
  toggleService: (serviceId: string) => void;
  setServices: (services: string[]) => void;
  clearServices: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      region: "US",
      selectedServices: ["netflix", "amazon-prime-video"],

      setRegion: (region) => set({ region }),

      toggleService: (serviceId) =>
        set((state) => ({
          selectedServices: state.selectedServices.includes(serviceId)
            ? state.selectedServices.filter((s) => s !== serviceId)
            : [...state.selectedServices, serviceId],
        })),

      setServices: (services) => set({ selectedServices: services }),

      clearServices: () => set({ selectedServices: [] }),
    }),
    {
      name: "nothing2see-app-store",
      partialize: (state) => ({
        region: state.region,
        selectedServices: state.selectedServices,
      }),
    }
  )
);
