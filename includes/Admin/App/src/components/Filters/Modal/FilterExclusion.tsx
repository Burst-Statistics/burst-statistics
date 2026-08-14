import { FILTER_OPERATOR_LABELS, isExcluding } from '@/config/filterConfig';
import LabelSwitchInput from '@/components/Inputs/LabelSwitchInput';
import React from 'react';

/**
 * Component to toggle between including or excluding a filter condition.
 *
 * Renders a `TabsList`-styled segmented switch between the "is" and "is not"
 * operator labels, both of which stay visible so the current state is
 * always readable. It checks if the current value indicates exclusion (by
 * checking if it starts with '!') and updates the value accordingly when
 * the user toggles the switch.
 */
export const FilterExclusion: React.FC<{ value: string; onChange: ( value: string ) => void; }> = ({ value, onChange }) => {
	const excluded = isExcluding( value );

	const handleChange = ( checked: boolean ) => {
		onChange(
			modifyValueBasedOnExclusionConfig(
				{
					value,
					excluded: checked
				}
			)
		);
	};

	return (
		<LabelSwitchInput
			value={excluded}
			onChange={handleChange}
			leftLabel={FILTER_OPERATOR_LABELS.is}
			rightLabel={FILTER_OPERATOR_LABELS['is-not']}
		/>
	);
};

export const modifyValueBasedOnExclusionConfig = ({ value, excluded }: { value: string, excluded: boolean }) => {
	return excluded ? `!${value.replace( /^!/, '' )}` : value.replace( /^!/, '' );
};
