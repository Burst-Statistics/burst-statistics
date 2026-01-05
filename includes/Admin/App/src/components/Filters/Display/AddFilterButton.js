import { __ } from '@wordpress/i18n';
import IconButton from '../../Inputs/IconButton';

/**
 * Reusable AddFilterButton component for adding new filters.
 * Uses the generic IconButton component with dashed variant styling.
 *
 * @param {Object}   props           - Component props.
 * @param {Function} props.onClick   - Callback function when button is clicked.
 * @param {string}   props.className - Additional CSS classes.
 * @param {string}   props.label     - Button label (default: 'Add filter').
 * @param {string}   props.icon      - Button icon (default: 'plus').
 * @return {JSX.Element} AddFilterButton component.
 */
const AddFilterButton = ({
	onClick,
	className = '',
	icon = 'plus',
	label = __( 'Add filter', 'burst-statistics' )
}) => {
	return (
		<IconButton
			variant="dashed"
			icon={icon}
			label={label}
			onClick={onClick}
			className={className}
			ariaLabel={label}
		/>
	);
};

export default AddFilterButton;
