import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import useGoalsData from '@/hooks/useGoalsData';
import useSelectorMatches from '@/hooks/useSelectorMatches';
import { isPageBoundSelector } from '@/utils/buildCssSelector';
import { getGoalPage } from '@/components/Goals/goalHelpers';
import type { Goal } from '@/components/Goals/goalHelpers';
import SelectorPickerModal from '@/components/Goals/GoalWizard/Fields/SelectorPickerModal';
import SelectorTestFrame from '@/components/Goals/GoalWizard/Fields/SelectorTestFrame';
import GoalStepHeading from '../GoalStepHeading';
import SelectedElementCard from './SelectedElementCard';
import PickElementPrompt from './PickElementPrompt';
import ManualSelectorInput from './ManualSelectorInput';

/**
 * What a click or view goal tracks: an element, picked on the page it lives on or typed as a selector.
 *
 * @param {Object} props      Component props.
 * @param {Goal}   props.goal The goal being edited.
 * @return {JSX.Element} The element step.
 */
const ElementTarget = ({ goal }: { goal: Goal }): JSX.Element => {
	const { setGoalValue } = useGoalsData();
	const [ loggedOut, setLoggedOut ] = useState( true );
	const [ isPickerOpen, setIsPickerOpen ] = useState( false );
	const [ isManualOpen, setIsManualOpen ] = useState( false );

	// Bumped on every pick, so the typed selector field starts over from the picked selector.
	const [ pickCount, setPickCount ] = useState( 0 );
	const matches = useSelectorMatches( goal.selector );
	const page = getGoalPage( goal );

	const handlePick = ( selector: string, elementText: string, pickedPage: string ) => {
		setGoalValue( goal.id, 'selector', selector );
		setGoalValue( goal.id, 'specific_page', pickedPage );
		setPickCount( pickCount + 1 );

		// A selector bound to this page (a position or bare tags) only holds here, so count it here unless the user decides otherwise.
		if ( isPageBoundSelector( selector ) ) {
			setGoalValue( goal.id, 'page_or_website', 'page' );
		}

		// Only name a goal the user has not named yet.
		if ( elementText && ( ! goal.title || __( 'New goal', 'burst-statistics' ) === goal.title ) ) {
			setGoalValue( goal.id, 'title', elementText );
		}
	};

	return (
		<>
			<GoalStepHeading
				title={'views' === goal.type ?
					__( 'Which element should we count views of?', 'burst-statistics' ) :
					__( 'Which element should we count clicks on?', 'burst-statistics' )}
				description={__( 'Open your site, go to any page where the element appears, and click it.', 'burst-statistics' )}
			/>

			{goal.selector ? (
				<SelectedElementCard
					selector={goal.selector}
					page={page}
					matches={matches}
					onPickAgain={() => setIsPickerOpen( true )}
					onEditSelector={() => setIsManualOpen( true )}
				/>
			) : (
				<PickElementPrompt onPick={() => setIsPickerOpen( true )} />
			)}

			<ManualSelectorInput
				key={pickCount}
				goalId={goal.id}
				goalType={goal.type}
				selector={goal.selector}
				onChange={( selector ) => setGoalValue( goal.id, 'selector', selector )}
				page={goal.specific_page}
				onPageChange={( value ) => setGoalValue( goal.id, 'specific_page', value )}
				isOpen={isManualOpen}
				onToggle={setIsManualOpen}
				error={matches.error}
				isTesting={matches.isTesting}
			/>

			<SelectorTestFrame matches={matches} page={page} loggedOut={loggedOut} title={`goal-${goal.id}-selector-hidden-tester`} />

			{isPickerOpen && (
				<SelectorPickerModal
					onClose={() => setIsPickerOpen( false )}
					onPick={handlePick}
					goalId={goal.id}
					goalType={goal.type}
					initialPage={page}
					loggedOut={loggedOut}
					onToggleLoggedOut={() => setLoggedOut( ! loggedOut )}
				/>
			)}
		</>
	);
};

export default ElementTarget;
