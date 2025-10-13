import { create } from "zustand";

// Define the store's state interface for better type safety
interface LicenseState {
  isPro: boolean;
  licenseStatus: string;
  setLicenseStatus: (licenseStatus: string) => void;
  isLicenseValid: () => boolean;
}

// Store instance
const useLicenseStore = create<LicenseState>((set, get) => ({
  isPro: window.burst_settings?.is_pro === "1",
  licenseStatus: window.burst_settings?.licenseStatus || "",
  setLicenseStatus: (licenseStatus: string) => {
    set({ licenseStatus });
  },
  isLicenseValid: () => {
    return "valid" === get().licenseStatus && get().isPro;
  },
}));
export default useLicenseStore;
