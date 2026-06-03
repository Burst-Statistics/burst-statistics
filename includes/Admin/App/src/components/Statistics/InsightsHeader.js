import { __ } from '@wordpress/i18n';
import { useInsightsStore } from '../../store/useInsightsStore';
import PopoverFilter from '../Common/PopoverFilter';

// User-selectable intervals. We intentionally expose only the common buckets
// (day/week/month) plus 'auto'. The 'hour' and 'year' intervals supported by
// the backend are still reachable through 'auto' when the active date range
// makes them appropriate (very short ranges or multi-year ranges).
const INTERVAL_OPTIONS = [
	{ value: 'auto', label: __( 'Auto', 'burst-statistics' ) },
	{ value: 'day', label: __( 'Day', 'burst-statistics' ) },
	{ value: 'week', label: __( 'Week', 'burst-statistics' ) },
	{ value: 'month', label: __( 'Month', 'burst-statistics' ) }
];

/**
 * InsightsHeader renders the metric selector popover for the Insights block.
 *
 * The popover combines two controls so the user can configure both the visible
 * metrics and the grouping interval in a single place. The interval segmented
 * control sits in PopoverFilter's `extraSection`, which respects the same
 * Apply/Reset flow as the metric checkboxes.
 *
 * @param {Object}   props                 - Component props.
 * @param {string[]} props.selectedMetrics - Currently active metric keys.
 * @param {Object}   props.filters         - Active block filters (used to show/hide conversions).
 * @return {JSX.Element} The rendered popover header.
 */
const InsightsHeader = ({ selectedMetrics, filters }) => {
	const setMetrics = useInsightsStore( ( state ) => state.setMetrics );
	const groupBy = useInsightsStore( ( state ) => state.groupBy );
	const setGroupBy = useInsightsStore( ( state ) => state.setGroupBy );

	const insightsOptions = {
		pageviews: {
			label: __( 'Pageviews', 'burst-statistics' ),
			default: true
		},
		visitors: {
			label: __( 'Visitors', 'burst-statistics' ),
			default: true
		},
		sessions: {
			label: __( 'Sessions', 'burst-statistics' )
		},
		bounces: {
			label: __( 'Bounces', 'burst-statistics' )
		},
		conversions: {
			label: __( 'Conversions', 'burst-statistics' ),
			default: 0 < filters.goal_id
		}
	};

	const onApply = ( value ) => {
		setMetrics( value );
	};

	// Render function for the interval segmented control. PopoverFilter passes
	// the pending value and setter so the selection is only committed when the
	// user clicks "Apply", consistent with the metric checkboxes above.
	// Styling matches the segmented control used in CompareToggle so the popover
	// feels visually consistent with the rest of the Statistics surface.
	const renderIntervalSelector = ( pendingValue, setPendingValue ) => (
		<div className="flex flex-col gap-1.5">
			<span className="text-xs font-semibold text-text-gray uppercase tracking-wide">
				{__( 'Group by', 'burst-statistics' )}
			</span>
			<div
				role="radiogroup"
				aria-label={__( 'Group by', 'burst-statistics' )}
				className="grid grid-flow-col auto-cols-fr gap-0.5 border border-gray-300 rounded-md bg-gray-200 p-0.5 shadow-sm"
			>
				{INTERVAL_OPTIONS.map( ( option ) => {
					const isActive = pendingValue === option.value;
					return (
						<button
							key={option.value}
							type="button"
							role="radio"
							aria-checked={isActive}
							onClick={() => setPendingValue( option.value )}
							className={[
								'text-sm px-3 py-1 transition-colors rounded-sm focus:outline-hidden font-medium',
								isActive ?
									'bg-green-50 text-green border-green border' :
									'bg-white text-text-gray hover:bg-gray-50 border border-transparent'
							].join( ' ' )}
						>
							{option.label}
						</button>
					);
				})}
			</div>
		</div>
	);

	return (
		<PopoverFilter
			selectedOptions={selectedMetrics}
			options={insightsOptions}
			onApply={onApply}
			extraSection={renderIntervalSelector}
			extraSectionValue={groupBy}
			onExtraSectionChange={setGroupBy}
			description={
				__(
					'When a single metric is selected, a dashed comparison line is shown on the chart. The comparison period is set in the date range picker.',
					'burst-statistics'
				)
			}
		/>
	);
};

export default InsightsHeader;
