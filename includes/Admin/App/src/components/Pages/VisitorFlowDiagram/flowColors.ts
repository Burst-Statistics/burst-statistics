import { __ } from '@wordpress/i18n';
import type { FlowNodeType } from './types';

/**
 * Maps visitor-flow node types to design-system CSS custom property colors.
 * Tokens adapt automatically in dark mode via dark-scope-tokens.css.
 */
export const FLOW_COLORS: Record<FlowNodeType, string> = {
	campaign: 'var(--color-green-500)',
	referrer: 'var(--color-blue-400)',
	search: 'var(--color-blue-400)',
	direct: 'var(--color-yellow-500)',
	internal: 'var(--color-orange-500)',
	converting: 'var(--color-primary-700)',
	exit: 'var(--color-red-500)',
	page: 'var(--color-gray-500)',
	other: 'var(--color-gray-400)'
};

/**
 * Maps visitor-flow node types to Icon.tsx names for at-a-glance recognition.
 */
const FLOW_ICONS: Record<FlowNodeType, string> = {
	campaign: 'campaign',
	referrer: 'referrers',
	search: 'search',
	direct: 'log-in',
	internal: 'page',
	converting: 'conversion',
	exit: 'log-out',
	page: 'website',
	other: 'other'
};

/**
 * Returns visitor flow node colors from the design-system token map.
 *
 * @return Palette mapping node types to CSS custom property colors.
 */
export const getFlowColors = (): Record<FlowNodeType, string> => FLOW_COLORS;

/**
 * Returns the Icon name for a visitor-flow category.
 *
 * @param type - Flow category.
 * @return Icon.tsx name for the category.
 */
export const getFlowIcon = ( type: FlowNodeType ): string =>
	FLOW_ICONS[type] || FLOW_ICONS.other;

/**
 * Returns a translated, human-readable label for a flow category.
 *
 * @param type - Flow category.
 * @return Translated category label.
 */
export const getFlowTypeLabel = ( type: FlowNodeType ): string => {
	const labels: Record<FlowNodeType, string> = {
		campaign: __( 'Campaign', 'burst-statistics' ),
		referrer: __( 'Referrer', 'burst-statistics' ),
		search: __( 'Search', 'burst-statistics' ),
		direct: __( 'Direct', 'burst-statistics' ),
		internal: __( 'Internal page', 'burst-statistics' ),
		converting: __( 'Converting step', 'burst-statistics' ),
		exit: __( 'Exit', 'burst-statistics' ),
		page: __( 'This page', 'burst-statistics' ),
		other: __( 'Other', 'burst-statistics' )
	};

	return labels[type];
};

/**
 * Generates legend entries for visitor-flow categories.
 *
 * @return Array of legend items with design-system colors and icons.
 */
export const getFlowLegendItems = (): Array<{
	id: string;
	label: string;
	color: string;
	icon: string;
	type: FlowNodeType;
}> => [
	{
		id: 'campaign',
		label: __( 'Campaign', 'burst-statistics' ),
		color: FLOW_COLORS.campaign,
		icon: FLOW_ICONS.campaign,
		type: 'campaign'
	},
	{
		id: 'referrer-search',
		label: __( 'Referrer / search', 'burst-statistics' ),
		color: FLOW_COLORS.referrer,
		icon: FLOW_ICONS.referrer,
		type: 'referrer'
	},
	{
		id: 'internal',
		label: __( 'Internal page', 'burst-statistics' ),
		color: FLOW_COLORS.internal,
		icon: FLOW_ICONS.internal,
		type: 'internal'
	},
	{
		id: 'direct',
		label: __( 'Direct', 'burst-statistics' ),
		color: FLOW_COLORS.direct,
		icon: FLOW_ICONS.direct,
		type: 'direct'
	},
	{
		id: 'converting',
		label: __( 'Converting step', 'burst-statistics' ),
		color: FLOW_COLORS.converting,
		icon: FLOW_ICONS.converting,
		type: 'converting'
	},
	{
		id: 'exit',
		label: __( 'Exit', 'burst-statistics' ),
		color: FLOW_COLORS.exit,
		icon: FLOW_ICONS.exit,
		type: 'exit'
	}
];
