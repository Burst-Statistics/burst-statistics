import { create } from 'zustand';

const useLicenseStore = create((set, get) => ({
    // The initial value comes from burst_settings.licenseStatus
    licenseStatus: burst_settings.licenseStatus,

    // Update the license status
    setLicenseStatus: (licenseStatus) => {
        set({ licenseStatus });
    },

    // Property that returns true if license is valid
    get isLicenseValid() {
        return 'valid' === get().licenseStatus && burst_settings.is_pro === '1';
    }
}));

export default useLicenseStore;

