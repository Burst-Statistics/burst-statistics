import { forwardRef } from 'react';
import { __ } from '@wordpress/i18n';
import IconButton from '../../Inputs/IconButton';

/**
 * Reusable AddFilterButton component for adding new filters.
 * Uses the generic IconButton component with dashed variant styling.
 * Forwards refs and rest props so it can be used as a Radix trigger (e.g. Tooltip).
 *
 * @param {Object}   props                - Component props.
 * @param {Function} props.onClick        - Callback function when button is clicked.
 * @param {string}   props.className      - Additional CSS classes.
 * @param {string}   props.label          - Button label (default: 'Add filter').
 * @param {string}   props.ariaLabel      - Accessible label, falls back to label.
 * @param {string}   props.icon           - Button icon (default: 'plus').
 * @param {boolean}  props.smallLabels    - Whether to use small size styling.
 * @param {boolean}  props.isHighlighted  - Whether to apply the green ring highlight (popover-open state).
 * @return {JSX.Element} AddFilterButton component.
 */
const AddFilterButton = forwardRef( (
	{
		onClick,
		className = '',
		icon = 'plus',
		label = __( 'Add filter', 'burst-statistics' ),
		ariaLabel,
		smallLabels = false,
		isHighlighted = false,
		...props
	},
	ref
) => {
	return (
		<IconButton
			ref={ref}
			variant="dashed"
			icon={icon}
			label={label}
			onClick={onClick}
			className={`${className} ${isHighlighted ? 'border-green-300 bg-white shadow-md ring-1 ring-green-300' : ''}`.trim()}
			ariaLabel={ariaLabel || label}
			size={smallLabels ? 'sm' : 'lg'}
			ariaExpanded={isHighlighted}
			{...props}
		/>
	);
});

AddFilterButton.displayName = 'AddFilterButton';

export default AddFilterButton;
