import useSettingsData from '@/hooks/useSettingsData';
import { isFeatureEnabled } from '@/utils/isFeatureEnabled';

/**
 * Whether a feature is on under essentials mode, for hiding its blocks.
 *
 * @param {string} slug - Feature slug, as in `burst_non_essential_features`.
 * @return {boolean} False when essentials mode turned the feature off.
 */
export const useIsFeatureEnabled = ( slug: string ): boolean => {
	const { getValue } = useSettingsData();

	return isFeatureEnabled( slug, getValue( 'essentials_mode' ), window.burst_settings );
};
