import { __ } from '@wordpress/i18n';
import type { RadioOption } from '@/components/Inputs/RadioButtonsInput';

/**
 * Every goal type, keyed by type. The server validates the same keys in config/goal-fields.php.
 */
const GOAL_TYPES: Record<string, RadioOption> = {
	clicks: {
		label: __( 'Clicks', 'burst-statistics' ),
		description: __( 'A button, link or form submit. Example: the "Get Pro" button.', 'burst-statistics' ),
		type: 'clicks',
		icon: 'mouse'
	},
	views: {
		label: __( 'Views', 'burst-statistics' ),
		description: __( 'A section someone actually saw. Example: the pricing table.', 'burst-statistics' ),
		type: 'views',
		icon: 'eye'
	},
	visits: {
		label: __( 'Visits', 'burst-statistics' ),
		description: __( 'Someone reached a page. Example: /thank-you after checkout.', 'burst-statistics' ),
		type: 'visits',
		icon: 'external-link'
	},
	hook: {
		label: __( 'Hook', 'burst-statistics' ),
		description: __( 'Server side, for developers. Example: woocommerce_thankyou.', 'burst-statistics' ),
		type: 'hook',
		icon: 'code'
	}
};

/**
 * The goal types a new goal can use. The server rejects hook goals when it hides them, so they are not offered.
 *
 * @return {Record<string, RadioOption>} The selectable goal types, keyed by type.
 */
export const getSelectableGoalTypes = (): Record<string, RadioOption> => {
	if ( ! window.burst_settings?.hide_hook_goals ) {
		return GOAL_TYPES;
	}
	return Object.fromEntries( Object.entries( GOAL_TYPES ).filter( ([ type ]) => 'hook' !== type ) );
};

/**
 * What a goal's conversion rate is relative to, keyed by its conversion_metric value.
 */
export const GOAL_METRICS: Record<string, RadioOption> = {
	visitors: {
		label: __( 'Visitors', 'burst-statistics' ),
		type: 'visitors',
		icon: 'visitors'
	},
	sessions: {
		label: __( 'Sessions', 'burst-statistics' ),
		type: 'sessions',
		icon: 'sessions'
	},
	pageviews: {
		label: __( 'Pageviews', 'burst-statistics' ),
		type: 'pageviews',
		icon: 'pageviews'
	}
};

/**
 * Label of a goal type, e.g. "Clicks".
 *
 * @param {string} type The goal type.
 * @return {string} The label, or the type itself when unknown.
 */
export const getGoalTypeLabel = ( type: string ): string => GOAL_TYPES[ type ]?.label ?? type;

/**
 * Icon of a goal type, e.g. "mouse" for clicks.
 *
 * @param {string} type The goal type.
 * @return {string} The icon name.
 */
export const getGoalTypeIcon = ( type: string ): string => GOAL_TYPES[ type ]?.icon ?? 'goals';
