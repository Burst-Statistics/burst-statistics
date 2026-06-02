import { create } from 'zustand';

const useShareableLinkStore = create( () => {
    const urlParams = new URLSearchParams( window.location.search );
    const isPdfMode = urlParams.has( 'pdf' );
    const isShareableLinkViewer = isPdfMode ? true : ( burst_settings?.share_link_permissions?.is_shareable_link_viewer || false );
    const canFilter = isPdfMode ? false : ( burst_settings?.share_link_permissions?.can_filter || false );
    const canFilterDateRange = isPdfMode ? false : ( burst_settings?.share_link_permissions?.can_change_date || false );

    // The story view is served at /burst-dashboard/story via browser-history routing,
    // so a pathname check at app-init is sufficient — no SPA navigation enters or
    // leaves /story during a session.
    const isStoryView = /\/burst-dashboard\/story\/?$/.test( window.location.pathname );

    return {
        isPdfMode,
        isShareableLinkViewer,
        isStoryView,
        userCanFilter: ! isShareableLinkViewer || canFilter,
        userCanFilterDateRange: ! isShareableLinkViewer || canFilterDateRange
    };
});

export default useShareableLinkStore;
