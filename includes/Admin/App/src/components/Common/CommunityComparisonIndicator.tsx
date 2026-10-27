import { Link } from '@tanstack/react-router';
import Icon from '@/utils/Icon';
import HelpTooltip from '@/components/Common/HelpTooltip';
import type {
	CommunityComparison,
	CommunityComparisonState
} from '@/utils/communityComparison';

interface CommunityComparisonIndicatorProps {
	comparison: CommunityComparison;
}

const PILL_CLASSES = 'inline-flex items-center rounded bg-gray-100 px-1.5 py-1 text-text-gray';

// The pill is greyed out until a comparison is available, and while the view is filtered.
const GREYED_OUT_CLASSES = 'opacity-40';
const STATE_CLASSES: Record<CommunityComparisonState, string> = {
	disabled: `${ GREYED_OUT_CLASSES } hover:opacity-100 hover:text-primary transition`,
	pending: GREYED_OUT_CLASSES,
	filtered: GREYED_OUT_CLASSES,
	active: ''
};

/**
 * Shows that a metric can be compared with similar websites, next to its value.
 *
 * Every state shows the same neutral pill with an icon; the comparison itself is
 * in the tooltip. There is deliberately no visible rank, so a site below the
 * community is not labelled as such on its dashboard. Until a comparison is
 * available, and while the view is filtered, the pill is greyed out. While data
 * sharing is off it links to the setting.
 *
 * @param props            Component props.
 * @param props.comparison The comparison from utils/communityComparison.
 * @return The indicator with its explanation in a tooltip.
 */
const CommunityComparisonIndicator = ({ comparison }: CommunityComparisonIndicatorProps ) => {
	const sharedProps = {
		className: `${ PILL_CLASSES } ${ STATE_CLASSES[ comparison.state ] }`,
		'aria-label': comparison.text,
		'data-tour': 'community-comparison',
		'data-community-state': comparison.state
	};
	const icon = <Icon name="compare-arrows" size={ 12 } color="currentColor" />;

	if ( 'disabled' === comparison.state ) {
		return (
			<HelpTooltip content={ comparison.text } delayDuration={ 200 }>
				<Link
					to="/settings/$settingsId"
					params={{ settingsId: 'general' }}
					search={{ group: 'anonymous_usage_data' }}
					{ ...sharedProps }
				>
					{ icon }
				</Link>
			</HelpTooltip>
		);
	}

	return (
		<HelpTooltip content={ comparison.text } delayDuration={ 200 }>
			<span { ...sharedProps }>
				{ icon }
			</span>
		</HelpTooltip>
	);
};

export default CommunityComparisonIndicator;
