import { create } from 'zustand';

interface Preferences {
  hapticsEnabled: boolean;
  setHapticsEnabled: (enabled: boolean) => void;
}

/** Session preferences only; durable preferences are part of the persistence phase. */
export const usePreferences = create<Preferences>((set) => ({
  hapticsEnabled: true,
  setHapticsEnabled: (hapticsEnabled) => set({ hapticsEnabled }),
}));
