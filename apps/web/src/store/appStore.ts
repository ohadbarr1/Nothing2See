import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SupportedRegion } from "@nothing2see/types";
import { setTokenGetter } from "@nothing2see/core";

export interface AuthUser {
  id: string;
  email: string;
  display_name: string | null;
}

export interface AppState {
  // ── Region & services (Phase 1) ──────────────────────────
  region: SupportedRegion;
  selectedServices: string[];
  setRegion: (region: SupportedRegion) => void;
  toggleService: (serviceId: string) => void;
  setServices: (services: string[]) => void;
  clearServices: () => void;

  // ── Auth (Phase 2) ────────────────────────────────────────
  user: AuthUser | null;
  token: string | null; // access token stored in memory
  gdprAccepted: boolean;

  login: (user: AuthUser, token: string) => void;
  logout: () => void;
  setToken: (token: string) => void;
  setGdprAccepted: (accepted: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Phase 1 defaults
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

      // Phase 2 auth defaults
      user: null,
      token: null,
      gdprAccepted: false,

      login: (user, token) => {
        set({ user, token });
        // Register the token getter so apiClient can attach Authorization header
        setTokenGetter(() => token);
      },

      logout: () => {
        set({ user: null, token: null });
        setTokenGetter(() => null);
      },

      setToken: (token) => {
        set({ token });
        setTokenGetter(() => token);
      },

      setGdprAccepted: (accepted) => set({ gdprAccepted: accepted }),
    }),
    {
      name: "nothing2see-app-store",
      // Persist region, services, user info, gdprAccepted but NOT the access token
      // (access token is short-lived; refresh via cookie on app load)
      partialize: (state) => ({
        region: state.region,
        selectedServices: state.selectedServices,
        user: state.user,
        gdprAccepted: state.gdprAccepted,
      }),
    }
  )
);

// On module load: restore setTokenGetter if a token was rehydrated
// (token is NOT persisted, so on reload we call refreshToken instead)
// The actual refresh-on-load logic lives in App.tsx
