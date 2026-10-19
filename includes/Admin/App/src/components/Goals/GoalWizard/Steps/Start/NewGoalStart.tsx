import { useEffect } from 'react';
import { __ } from '@wordpress/i18n';
import useGoalsData from '@/hooks/useGoalsData';
import { useGoalWizardStore } from '@/store/goals/useGoalWizardStore';
import StartChoiceCards from './StartChoiceCards';
import PresetList from './PresetList';
import CustomGoalType from './CustomGoalType';
import GoalStepHeading from '../GoalStepHeading';

/**
 * How a new goal starts: a preset for a detected plugin, or a custom goal of a chosen type.
 *
 * @return {JSX.Element} The start choice.
 */
const NewGoalStart = (): JSX.Element => {
	const { predefinedGoals } = useGoalsData();
	const startMode = useGoalWizardStore( ( state ) => state.startMode );
	const setStartMode = useGoalWizardStore( ( state ) => state.setStartMode );
	const presetCount = predefinedGoals.length;
	const hasPresets = 0 < presetCount;

	// Default to the quickest path: a preset when one is available.
	useEffect( () => {
		if ( null === startMode ) {
			setStartMode( hasPresets ? 'preset' : 'custom' );
		}
	}, [ startMode, hasPresets, setStartMode ]);

	return (
		<div className="flex flex-col gap-8 p-4 lg:p-10">
			<GoalStepHeading
				title={__( 'How do you want to start?', 'burst-statistics' )}
				description={__( 'A preset is already set up for a plugin you use. A custom goal lets you track anything on your site.', 'burst-statistics' )}
			/>

			<StartChoiceCards presetCount={presetCount} />

			{'preset' === startMode && hasPresets && <PresetList />}

			{'custom' === startMode && <CustomGoalType />}
		</div>
	);
};

export default NewGoalStart;
