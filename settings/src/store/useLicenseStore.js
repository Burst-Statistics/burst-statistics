import {create} from 'zustand';
const useLicenseStore = create( ( set, get ) => ({
    licenseStatus: burst_settings.licenseStatus,
    setLicenseStatus: ( licenseStatus ) => set( state => ({ licenseStatus }) )
}) );

export default useLicenseStore;

