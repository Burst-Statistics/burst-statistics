import { __ } from '@wordpress/i18n';
import { createInterpolateElement } from '@wordpress/element';
import { useGoalWizardStore } from '@/store/goals/useGoalWizardStore';
import { GOAL_STEP, formatExtensionsList, getGoalKind, isElementType, parseEventFilter } from '@/components/Goals/goalHelpers';
import type { Goal } from '@/components/Goals/goalHelpers';
import { getTracksText, getWhereText } from '@/components/Goals/goalText';
import GoalReviewRow from './GoalReviewRow';

/**
 * What the goal counts: the element's selector for click and view goals, the page or hook otherwise.
 *
 * @param {Goal} goal The goal.
 * @return {JSX.Element | string} What it counts.
 */
// fallow-ignore-next-line complexity
const getCountsValue = ( goal: Goal ): JSX.Element | string => {
	const kind = getGoalKind( goal );
	if ( 'download' === kind ) {
		const filter = parseEventFilter( goal.event_filter );
		if ( filter && 'file_name' === filter.key && 'string' === typeof filter.value && filter.value ) {
			return createInterpolateElement(

				/* translators: <file />: file name e.g. brochure-2026.pdf */
				__( 'Downloads of <file />', 'burst-statistics' ),
				{ file: <code className="font-mono font-semibold">{filter.value}</code> }
			);
		}
		if ( filter && 'file_extension' === filter.key && Array.isArray( filter.value ) && 0 < filter.value.length ) {
			const extensions = formatExtensionsList( filter.value );
			return createInterpolateElement(

				/* translators: <ext />: file extensions e.g. PDF, ZIP */
				__( 'Downloads of <ext /> files', 'burst-statistics' ),
				{ ext: <code className="font-mono font-semibold">{extensions}</code> }
			);
		}
		return __( 'Any file download', 'burst-statistics' );
	}

	if ( 'event' === kind ) {
		return goal.hook ?
			createInterpolateElement(

				/* translators: <event />: event name e.g. generate_lead */
				__( 'When <event /> is sent', 'burst-statistics' ),
				{ event: <code className="font-mono font-semibold">{goal.hook}</code> }
			) : '';
	}

	if ( 'hook' === kind ) {
		return goal.hook ?
			createInterpolateElement(

				/* translators: <hook />: hook name e.g. woocommerce_thankyou */
				__( 'When <hook /> runs', 'burst-statistics' ),
				{ hook: <code className="font-mono font-semibold">{goal.hook}</code> }
			) : '';
	}

	if ( ! isElementType( goal.type ) ) {
		return getTracksText( goal );
	}

	const selector = { selector: <code className="font-mono break-all">{goal.selector}</code> };
	return 'views' === goal.type ?

		/* translators: <selector />: the element's CSS selector. */
		createInterpolateElement( __( 'Views of <selector />', 'burst-statistics' ), selector ) :

		/* translators: <selector />: the element's CSS selector. */
		createInterpolateElement( __( 'Clicks on <selector />', 'burst-statistics' ), selector );
};

/**
 * What the goal counts and where, each with a link back to the step that set it.
 *
 * @param {Object} props      Component props.
 * @param {Goal}   props.goal The goal being saved.
 * @return {JSX.Element} The review rows.
 */
const GoalReviewRows = ({ goal }: { goal: Goal }): JSX.Element => {
	const setCurrentStep = useGoalWizardStore( ( state ) => state.setCurrentStep );

	return (
		<div className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
			<GoalReviewRow label={__( 'Counts', 'burst-statistics' )} onEdit={() => setCurrentStep( GOAL_STEP.TARGET )}>
				{getCountsValue( goal )}
			</GoalReviewRow>

			{isElementType( goal.type ) && (
				<GoalReviewRow label={__( 'Where', 'burst-statistics' )} onEdit={() => setCurrentStep( GOAL_STEP.COUNT )}>
					{getWhereText( goal )}
				</GoalReviewRow>
			)}
		</div>
	);
};

export default GoalReviewRows;
