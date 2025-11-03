import { create } from "zustand";
import { persist } from "zustand/middleware";

type PageSetting = 'all' | 'custom';

interface FunnelStoreState {
    pageSettings: PageSetting;
    setPageSettings: ( setting: PageSetting ) => void;
    selectedPages: string[];
    setSelectedPages: ( page: string[] ) => void;
}

export const useFunnelStore = create<FunnelStoreState>()(
    persist(
        ( set ) => ({
            pageSettings: 'all',
            setPageSettings: ( setting ) => set({
                pageSettings: setting,
            }),
            selectedPages: [],
            setSelectedPages: ( pages ) => set({
                selectedPages: pages,
            }),
        }),
        {
            name: "burst_funnel_store",
        }
    )
);
