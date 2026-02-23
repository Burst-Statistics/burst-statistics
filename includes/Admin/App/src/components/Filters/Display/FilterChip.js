import { clsx } from 'clsx';
import Icon from '../../../utils/Icon';
import { safeDecodeURI } from '../../../utils/lib';
import { __ } from '@wordpress/i18n';

/**
 * Reusable FilterChip component for displaying active filters
 *
 * @param {Object}   props                  - Component props
 * @param {Object}   props.filter           - Filter object with key, value, displayValue, and config
 * @param {Function} props.onRemove         - Callback function when remove button is clicked
 * @param {Function} props.onClick          - Callback function when chip is clicked to edit
 * @param {string}   props.className        - Additional CSS classes
 * @param {boolean}  props.showRemoveButton - Whether to show the remove button (default: true)
 * @param {boolean}  props.disabled         - Whether the chip is disabled (default: false)
 * @param {boolean}  props.smallLabels      - Whether to use small size styling (px-2 py-1 text-xs) (default: false)
 * @return {JSX.Element} FilterChip component
 */
const FilterChip = ({
						filter,
						onRemove,
						onClick,
						className = '',
						showRemoveButton = true,
						disabled = false,
						smallLabels = false
					}) => {
	const chipClasses = clsx(

		// Base styles.
		'inline-flex items-center gap-2 border shadow-sm rounded-md transition-all duration-200',

		// Size-specific styles.
		{
			'px-2 py-1 text-xs': smallLabels,
			'px-3 py-2 text-sm': ! smallLabels
		},

		// State-specific styles.
		{
			'bg-gray-100 border-gray-200 cursor-not-allowed opacity-60': disabled,
			'bg-white border-gray-300 hover:bg-gray-50 hover:[box-shadow:0_0_0_3px_rgba(0,0,0,0.05)] cursor-pointer': ! disabled
		},

		className
	);

	const handleChipClick = ( e ) => {
		if ( disabled ) {
			return;
		}

		// Don't trigger chip click if clicking on remove button
		if ( e.target.closest( '.remove-button' ) ) {
			return;
		}
		if ( onClick ) {
			onClick( filter );
		}
	};

	const handleKeyDown = ( e ) => {
		if ( disabled ) {
			return;
		}

		if ( 'Enter' === e.key || ' ' === e.key ) {
			e.preventDefault();
			handleChipClick( e );
		}
	};

	const handleRemove = ( e ) => {
		if ( disabled ) {
			e.stopPropagation();
			return;
		}
		if ( onRemove ) {
			onRemove( filter.key );
		}
	};

	// prevent critical errors if filter is not valid, due to changed filter structure.
	if ( ! filter || ! filter.config ) {
		localStorage.removeItem( 'burst-filters-storage' );
		return null; // Return null if filter is not valid
	}

	if ( ! filter.key ) {
		return null; // Return null if filter key is not valid
	}

	return (
		<div
			className={chipClasses}
			onClick={handleChipClick}
			onKeyDown={handleKeyDown}
			role="button"
			tabIndex={disabled ? -1 : 0}
			aria-label={__( 'Edit %s filter', 'burst-statistics' ).replace(
				'%s',
				filter.config.label
			)}
			aria-disabled={disabled}
			title={disabled ? '' : __( 'Click to edit filter', 'burst-statistics' )}
		>
			{/* Filter Icon */}
			<Icon name={filter.config.icon} size={smallLabels ? 14 : 16} />

			{/* Filter Label */}
			<p className={clsx(
				'font-medium',
				{ 'text-gray-800': disabled }
			)}>
				{filter.config.label}
			</p>

			{/* Separator */}
			<span className={clsx(
				'w-px',
				smallLabels ? 'h-3' : 'h-4',
				disabled ? 'bg-gray-300' : 'bg-gray-400'
			)}></span>

			{/* Filter Value */}
			<p className={clsx(
				{ 'text-gray-800': disabled, 'text-gray': ! disabled }
			)}>
				{safeDecodeURI( filter.displayValue )}
			</p>

			{/* Remove Button */}
			{showRemoveButton && onRemove && ! disabled && (
				<button
					onClick={handleRemove}
					disabled={disabled}
					className={clsx(
						'remove-button rounded-full transition-colors',
						smallLabels ? 'p-0.5' : 'p-1',
						{
							'cursor-not-allowed opacity-50': disabled,
							'hover:bg-gray-200': ! disabled
						}
					)}
					aria-label={__( 'Remove filter', 'burst-statistics' )}
					title={disabled ? '' : __( 'Remove filter', 'burst-statistics' )}
				>
					<Icon
						name="times"
						color={disabled ? 'var(--rsp-grey-300)' : 'var(--rsp-grey-500)'}
						size={smallLabels ? 14 : 16}
					/>
				</button>
			)}
		</div>
	);
};

export default FilterChip;
