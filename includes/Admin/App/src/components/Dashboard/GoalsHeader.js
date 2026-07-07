import React, { useMemo } from 'react';
import { __ } from '@wordpress/i18n';
import AsyncSelectInput from '@/components/Inputs/AsyncSelectInput';
import Icon from '../../utils/Icon';

/**
 * GoalsHeader component to display and select goals.
 *
 * @param {Object}        props           - The component props.
 * @param {Array}         props.goals     - Array of goal objects.
 * @param {string|number} props.goalId    - Currently selected goal ID.
 * @param {Function}      props.setGoalId - Function to update the selected goal ID.
 *
 * @return {JSX.Element|null} The rendered GoalsHeader component or null if no goals.
 */
const GoalsHeader = ({ goals, goalId, setGoalId }) => {

	const options = useMemo( () => {
		return [
			{
				value: 'all',
				label: __( 'All goals', 'burst-statistics' )
			},
			...goals.map( ( goal ) => ({
				value: String( goal.id ),
				label:
					goal && 'string' === typeof goal.title ?
						goal.title :
						__( 'Untitled goal', 'burst-statistics' )
			}) )
		];
	}, [ goals ]);

	// Filter options locally on search input
	const loadOptions = ( input, callback ) => {
		const query = ( input || '' ).toLowerCase();
		const filtered = options.filter( ( option ) =>
			option.label.toLowerCase().includes( query )
		);
		callback( filtered );
	};

	// if goals is an empty array, return a loading indicator.
	if ( 0 === goals.length ) {
		return <Icon name="loading" />;
	}

	return (
		<div className="flex items-center gap-2.5">
			<AsyncSelectInput
				value={String( goalId )}
				onChange={( selected ) => setGoalId( selected ? selected.value : 'all' )}
				defaultOptions={options}
				loadOptions={loadOptions}
				isSearchable={true}
				allowCustomValue={false}
				maxSelections={1}
				placeholder={__( 'Select a goal...', 'burst-statistics' )}
				className="!min-h-[2rem] !h-8 !w-48 !text-sm focus-within:!border-primary focus-within:!ring-primary [&>div]:!p-0 [&>div]:!pl-1.5 [&_span]:!py-0.5 [&_span]:!px-1.5 [&_span]:!text-sm [&_input]:!p-0 [&_input]:!text-sm [&_button]:!py-1"
			/>
		</div>
	);
};

export default GoalsHeader;
