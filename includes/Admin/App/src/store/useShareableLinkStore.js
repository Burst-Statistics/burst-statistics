import { create } from 'zustand';

const useShareableLinkStore = create( () => {
    const isShareableLinkViewer = burst_settings?.share_link_permissions?.is_shareable_link_viewer || false;
    const canFilter = burst_settings?.share_link_permissions?.can_filter || false;
    const canFilterDateRange = burst_settings?.share_link_permissions?.can_change_date || false;

    return {
        isShareableLinkViewer,
        userCanFilter: ! isShareableLinkViewer || canFilter,
        userCanFilterDateRange: ! isShareableLinkViewer || canFilterDateRange
    };
});

export default useShareableLinkStore;
