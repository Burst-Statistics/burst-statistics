import { __ } from '@wordpress/i18n';
import IconButton from '../../Inputs/IconButton';

/**
 * Reusable AddFilterButton component for adding new filters.
 * Uses the generic IconButton component with dashed variant styling.
 *
 * @param {Object}   props                - Component props.
 * @param {Function} props.onClick        - Callback function when button is clicked.
 * @param {string}   props.className      - Additional CSS classes.
 * @param {string}   props.label          - Button label (default: 'Add filter').
 * @param {string}   props.icon           - Button icon (default: 'plus').
 * @param {boolean}  props.smallLabels    - Whether to use small size styling.
 * @param {boolean}  props.isHighlighted  - Whether to apply the green ring highlight (popover-open state).
 * @return {JSX.Element} AddFilterButton component.
 */
const AddFilterButton = ({
	onClick,
	className = '',
	icon = 'plus',
	label = __( 'Add filter', 'burst-statistics' ),
	smallLabels = false,
	isHighlighted = false
}) => {
	return (
		<IconButton
			variant="dashed"
			icon={icon}
			label={label}
			onClick={onClick}
			className={`${className} ${isHighlighted ? 'border-green-300 bg-white shadow-md ring-1 ring-green-300' : ''}`.trim()}
			ariaLabel={label}
			size={smallLabels ? 'sm' : 'lg'}
			ariaExpanded={isHighlighted}
		/>
	);
};

export default AddFilterButton;
