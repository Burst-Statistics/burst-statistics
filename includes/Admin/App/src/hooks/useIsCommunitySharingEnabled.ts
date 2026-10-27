import useSettingsData from '@/hooks/useSettingsData';
import { isTourActive } from '@/store/useTourStore';

/**
 * Whether community comparisons should be shown as available.
 *
 * True when the site shares anonymous usage data, and during the tour, which
 * shows the comparisons with mock data.
 *
 * @return Whether community comparisons are enabled.
 */
const useIsCommunitySharingEnabled = (): boolean => {
	const { getValue } = useSettingsData();

	return !! getValue( 'anonymous_usage_data' ) || isTourActive();
};

export default useIsCommunitySharingEnabled;
