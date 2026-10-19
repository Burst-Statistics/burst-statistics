import { __, sprintf } from '@wordpress/i18n';
import { createInterpolateElement } from '@wordpress/element';
import useGoalsData from '@/hooks/useGoalsData';
import { isPageBoundSelector } from '@/utils/buildCssSelector';
import { getGoalPage, getShortSelector } from '@/components/Goals/goalHelpers';
import type { Goal } from '@/components/Goals/goalHelpers';
import useWizardGoal from '../useWizardGoal';
import GoalStepHeading from './GoalStepHeading';
import GoalInfoNote from './GoalInfoNote';
import GoalScopeOption from './Count/GoalScopeOption';

/**
 * The sentence under the options: what exactly will count as a conversion.
 *
 * @param {Goal} goal The goal.
 * @return {JSX.Element} The sentence.
 */
const getCountsSentence = ( goal: Goal ): JSX.Element => {
	const isWholeSite = 'page' !== goal.page_or_website;
	const elements = {
		selector: <code className="font-mono">{getShortSelector( goal.selector )}</code>,
		page: <strong>{getGoalPage( goal )}</strong>,
		b: <strong />
	};

	if ( 'views' === goal.type ) {
		return createInterpolateElement( isWholeSite ?

			/* translators: <selector />: the element's CSS selector. */
			__( 'A conversion is counted when <selector /> comes into view on <b>any page</b> of your site.', 'burst-statistics' ) :

			/* translators: <selector />: the element's CSS selector, <page />: the page path. */
			__( 'A conversion is counted when <selector /> comes into view on <page />.', 'burst-statistics' ),
		elements );
	}

	return createInterpolateElement( isWholeSite ?

		/* translators: <selector />: the element's CSS selector. */
		__( 'A conversion is counted when a visitor clicks <selector /> on <b>any page</b> of your site.', 'burst-statistics' ) :

		/* translators: <selector />: the element's CSS selector, <page />: the page path. */
		__( 'A conversion is counted when a visitor clicks <selector /> on <page />.', 'burst-statistics' ),
	elements );
};

/**
 * The wording of the scope step, which depends on whether clicks or views count
 * and on whether the element was found on a page or typed as a selector.
 *
 * @param {Goal}   goal The goal.
 * @param {string} page The page the element was found or checked on.
 * @return {{title: string, description: string, ignored: string, warning: string}} The step's texts.
 */
const getScopeCopy = ( goal: Goal, page: string ): { title: string; description: string; ignored: string; warning: string } => {
	const isViews = 'views' === goal.type;

	return {
		title: isViews ?
			__( 'Where should a view count?', 'burst-statistics' ) :
			__( 'Where should a click count?', 'burst-statistics' ),
		description: goal.specific_page ?
			sprintf(

				/* translators: %s: page path, e.g. /pricing/. */
				__( 'You found this element on %s. It may also appear on other pages.', 'burst-statistics' ),
				page
			) :
			__( 'You typed this selector without picking a page, so it is checked on your home page. It may also appear on other pages.', 'burst-statistics' ),
		ignored: isViews ?
			__( 'Views of the same element on other pages are ignored.', 'burst-statistics' ) :
			__( 'Clicks on the same element on other pages are ignored.', 'burst-statistics' ),
		warning: sprintf(
			isViews ?

				/* translators: %s: page path, e.g. /pricing/. */
				__( 'This element is only recognised by where it sits on %s. On other pages that spot can hold a different element, so unrelated views would count. Count it only on this page, or pick an element with its own id or class.', 'burst-statistics' ) :

				/* translators: %s: page path, e.g. /pricing/. */
				__( 'This element is only recognised by where it sits on %s. On other pages that spot can hold a different element, so unrelated clicks would count. Count it only on this page, or pick an element with its own id or class.', 'burst-statistics' ),
			page
		)
	};
};

/**
 * Step 3, click and view goals only: count the element on every page it appears, or only on the page it was found on.
 *
 * @return {JSX.Element | null} The scope step.
 */
const StepCount = (): JSX.Element | null => {
	const goal = useWizardGoal();
	const { setGoalValue } = useGoalsData();

	if ( ! goal ) {
		return null;
	}

	const page = getGoalPage( goal );
	const copy = getScopeCopy( goal, page );
	const setScope = ( scope: string ) => setGoalValue( goal.id, 'page_or_website', scope );

	return (
		<div className="flex flex-col gap-6 p-4 lg:p-10">
			<GoalStepHeading title={copy.title} description={copy.description} />

			<div className="flex flex-col gap-3" data-tour="goal-field-page_or_website">
				<GoalScopeOption
					name={`goal-${goal.id}-page_or_website`}
					value="website"
					title={__( 'On every page where this element appears', 'burst-statistics' )}
					description={__( 'Best for buttons in your header, footer or on several landing pages.', 'burst-statistics' )}
					isSelected={'page' !== goal.page_or_website}
					onSelect={setScope}
				/>
				<GoalScopeOption
					name={`goal-${goal.id}-page_or_website`}
					value="page"
					title={sprintf(

						/* translators: %s: page path, e.g. /pricing/. */
						__( 'Only on %s', 'burst-statistics' ),
						page
					)}
					description={copy.ignored}
					isSelected={'page' === goal.page_or_website}
					onSelect={setScope}
				/>
			</div>

			{/* A position or bare tag is only unique on the page it was picked on; elsewhere it can be any element. */}
			{'page' !== goal.page_or_website && isPageBoundSelector( goal.selector ) && (
				<GoalInfoNote isWarning>{copy.warning}</GoalInfoNote>
			)}

			<GoalInfoNote>{getCountsSentence( goal )}</GoalInfoNote>
		</div>
	);
};

export default StepCount;
