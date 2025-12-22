import { __ } from '@wordpress/i18n';

/**
 * DisabledBadge Component
 *
 * A reusable component to display a "Disabled" badge
 *
 * @param {Object} props             - Component props
 * @param {string} [props.className] - Additional classes to apply to the badge (optional)
 * @return {JSX.Element}
 */
const DisabledBadge = ({ className = '' }) => {
	return (
		<span
			className={`inline-flex items-center rounded bg-gray-300 px-2 py-0.5 text-xs font-medium text-gray ${className}`}
		>
			{__( 'Disabled', 'burst-statistics' )}
		</span>
	);
};

export default DisabledBadge;
