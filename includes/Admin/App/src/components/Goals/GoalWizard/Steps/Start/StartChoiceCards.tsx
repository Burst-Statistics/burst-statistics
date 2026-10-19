import { __, _n, sprintf } from '@wordpress/i18n';
import useLicenseData from '@/hooks/useLicenseData';
import ProBadge from '@/components/Common/ProBadge';
import { useGoalWizardStore } from '@/store/goals/useGoalWizardStore';
import StartChoiceCard from './StartChoiceCard';

/**
 * What the preset card says about the presets found for this site.
 *
 * @param {number} presetCount Number of presets for the detected plugins.
 * @return {string} The description.
 */
const getPresetDescription = ( presetCount: number ): string => {
	if ( 0 === presetCount ) {
		return __( 'No supported plugins detected on this site.', 'burst-statistics' );
	}

	return sprintf(

		/* translators: %d: number of presets available for the detected plugins. */
		_n( 'Ready to track. %d preset found for your plugins.', 'Ready to track. %d presets found for your plugins.', presetCount, 'burst-statistics' ),
		presetCount
	);
};

/**
 * The two ways to start a new goal: from a preset or built from scratch.
 *
 * @param {Object} props             Component props.
 * @param {number} props.presetCount Number of presets for the detected plugins.
 * @return {JSX.Element} The choice cards.
 */
const StartChoiceCards = ({ presetCount }: { presetCount: number }): JSX.Element => {
	const { isPro } = useLicenseData();
	const startMode = useGoalWizardStore( ( state ) => state.startMode );
	const setStartMode = useGoalWizardStore( ( state ) => state.setStartMode );
	const hasPresets = 0 < presetCount;

	return (
		<div className="flex flex-col gap-3 sm:flex-row">
			<StartChoiceCard
				icon="sparkles"
				title={__( 'Use a preset', 'burst-statistics' )}
				description={getPresetDescription( presetCount )}
				badge={! isPro && hasPresets && (
					<ProBadge label={__( 'Pro', 'burst-statistics' )} />
				)}
				isSelected={'preset' === startMode}
				disabled={! hasPresets}
				onSelect={() => setStartMode( 'preset' )}
				dataTour="goal-wizard-start-preset"
			/>
			<StartChoiceCard
				icon="pencil"
				title={__( 'Build your own', 'burst-statistics' )}
				description={__( 'Track a click, an element coming into view, a page visit or a WordPress hook.', 'burst-statistics' )}
				isSelected={'custom' === startMode}
				onSelect={() => setStartMode( 'custom' )}
				dataTour="goal-wizard-start-custom"
			/>
		</div>
	);
};

export default StartChoiceCards;
