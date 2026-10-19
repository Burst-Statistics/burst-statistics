import { __ } from '@wordpress/i18n';
import { getSelectableGoalTypes } from '@/components/Goals/goalOptions';
import StartChoiceCard from './StartChoiceCard';

// What each goal type counts, as a site owner would put it.
const TYPE_TITLES: Record<string, string> = {
	clicks: __( 'A click on something', 'burst-statistics' ),
	views: __( 'Something scrolled into view', 'burst-statistics' ),
	visits: __( 'A visit to a page', 'burst-statistics' ),
	hook: __( 'A WordPress hook', 'burst-statistics' )
};

interface GoalTypeCardsProps {
	value: string;
	onChange: ( type: string ) => void;
}

/**
 * The goal types as cards, two per row: what a conversion looks like.
 *
 * @param {GoalTypeCardsProps} props          Component props.
 * @param {string}             props.value    The selected type.
 * @param {Function}           props.onChange Called with the chosen type.
 * @return {JSX.Element} The type cards.
 */
const GoalTypeCards = ({ value, onChange }: GoalTypeCardsProps ): JSX.Element => (
	<div className="grid grid-cols-1 gap-4 sm:grid-cols-2" data-tour="goal-field-type">
		{Object.values( getSelectableGoalTypes() ).map( ( option ) => (
			<StartChoiceCard
				key={option.type}
				icon={option.icon ?? 'goals'}
				title={TYPE_TITLES[ option.type ] ?? option.label}
				description={option.description ?? ''}
				isSelected={value === option.type}
				onSelect={() => onChange( option.type )}
				dataTour={`wizard-format-${option.type}`}
			/>
		) )}
	</div>
);

export default GoalTypeCards;
