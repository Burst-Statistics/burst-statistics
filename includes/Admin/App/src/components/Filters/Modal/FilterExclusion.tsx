import { isExcluding } from '@/config/filterConfig';
import SelectInput from '@/components/Inputs/SelectInput';
import React from 'react';
import { __ } from '@wordpress/i18n';

const EXCLUSION_OPTIONS = [
	{ value: 'include', label: __( 'Include', 'burst-statistics' ) },
	{ value: 'exclude', label: __( 'Exclude', 'burst-statistics' ) }
];

/**
 * Component to toggle between including or excluding a filter condition.
 *
 * This component uses a SelectInput to allow users to choose whether they want to include or exclude a filter condition.
 * It checks if the current value indicates exclusion (by checking if it starts with '!') and updates the value accordingly when the user changes the selection.
 */
export const FilterExclusion: React.FC<{ value: string; onChange: ( value: string ) => void; }> = ({ value, onChange }) => {
	const filterOptionSelectedOption = isExcluding( value ) ? 'exclude' : 'include';

	const handleChange = ( exclusionValue: string ) => {
		onChange(
			modifyValueBasedOnExclusionConfig(
				{
					value,
					excluded: 'exclude' === exclusionValue
				}
			)
		);
	};

	return (
		<SelectInput
			value={ filterOptionSelectedOption }
			onChange={handleChange}
			options={EXCLUSION_OPTIONS}
		/>
	);
};

export const modifyValueBasedOnExclusionConfig = ({ value, excluded }: { value: string, excluded: boolean }) => {
	return excluded ? `!${value.replace( /^!/, '' )}` : value.replace( /^!/, '' );
};
