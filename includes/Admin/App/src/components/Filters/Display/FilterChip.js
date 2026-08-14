import { clsx } from 'clsx';
import Icon from '../../../utils/Icon';
import { safeDecodeURI } from '../../../utils/lib';
import { __ } from '@wordpress/i18n';
import { buildCountLabel, FILTER_OPERATOR_LABELS } from '@/config/filterConfig';
import Tooltip from '@/components/Common/Tooltip';

/**
 * Plain-language tooltip descriptions for each filter operator.
 */
const FILTER_OPERATOR_TOOLTIP_DESCRIPTIONS = {
	is: __( 'Showing data where this value matches.', 'burst-statistics' ),
	'is-not': __( 'Hiding data where this value matches.', 'burst-statistics' ),
	'is-any-of': __( 'Showing data that matches any of these values.', 'burst-statistics' ),
	'is-not-any-of': __( 'Hiding data that matches any of these values.', 'burst-statistics' )
};

/**
 * Reusable FilterChip component for displaying active filters.
 *
 * Styled after the DateRange trigger (`Statistics/DateRange.js`): a dimension
 * icon on the left, a small label above the value ("Referrer"), and the
 * operator and value/count badge below it ("is google.com" / "is google.com
 * or facebook.com" / "is any of 3 referrers"). Clicking the chip opens the
 * edit wizard. Exclude
 * operators ("is not" / "is not one of") are rendered in the same neutral
 * style as include operators, prefixed with a "ban" icon — red is reserved
 * for actual errors, not for exclusion.
 *
 * Multi-value chips with exactly two selected values show both values joined
 * by "or" under the singular "is" / "is not" operator. Three or more values
 * collapse to an aggregate count badge under "is any of" / "is not one of".
 * On hover, every chip shows a tooltip with the dimension and operator, the
 * selected value(s), a plain-language explanation of how the filter matches
 * data, and a "Click to edit" hint.
 *
 * @param {Object}    props                    - Component props.
 * @param {Object}    props.filter             - Filter object with key, value, displayValue, values, isExcluded, operator, and config.
 * @param {Function}  [props.onRemove]         - Callback function when remove button is clicked.
 * @param {Function}  [props.onClick]          - Callback function when chip is clicked to edit.
 * @param {string}    [props.className]        - Additional CSS classes.
 * @param {boolean}   [props.showRemoveButton] - Whether to show the remove button (default: true).
 * @param {boolean}   [props.disabled]         - Whether the chip is disabled (default: false).
 * @param {boolean}   [props.smallLabels]      - Whether to use small size styling (px-2 py-1) (default: false).
 * @param {boolean}   [props.isHighlighted]    - Whether to apply the green ring highlight (popover-open state).
 * @return {JSX.Element} FilterChip component.
 */
// fallow-ignore-next-line complexity
const FilterChip = ({
	filter,
	onRemove,
	onClick,
	className = '',
	showRemoveButton = true,
	disabled = false,
	smallLabels = false,
	isHighlighted = false
}) => {

	// prevent critical errors if filter is not valid, due to changed filter structure.
	if ( ! filter || ! filter.config ) {
		localStorage.removeItem( 'burst-filters-storage' );
		return null; // Return null if filter is not valid
	}

	if ( ! filter.key ) {
		return null; // Return null if filter key is not valid
	}

	const isMultiValue = Array.isArray( filter.values ) && 1 < filter.values.length;
	const isTwoValues = Array.isArray( filter.values ) && 2 === filter.values.length;

	// Two values read more naturally as "is A or B" than "is any of A or B".
	const operatorLabel = isTwoValues ?
		( filter.isExcluded ? FILTER_OPERATOR_LABELS['is-not'] : FILTER_OPERATOR_LABELS.is ) :
		( FILTER_OPERATOR_LABELS[filter.operator] || FILTER_OPERATOR_LABELS.is );
	const iconSize = smallLabels ? 14 : 16;

	/**
	 * Resolves the chip's value label: a single display value, two values
	 * joined by "or", or a collapsed count badge for 3+ values.
	 *
	 * @return {string} The formatted value label.
	 */
	const getValueLabel = () => {
		if ( isTwoValues ) {
			return `${ safeDecodeURI( filter.values[0].display ) } ${ __( 'or', 'burst-statistics' ) } ${ safeDecodeURI( filter.values[1].display ) }`;
		}

		if ( isMultiValue ) {
			return buildCountLabel( filter.config, filter.values.length );
		}

		return safeDecodeURI( filter.displayValue );
	};

	// Styled after the DateRange trigger (burst-date-button).
	const chipClasses = clsx(
		'burst-filter-chip flex items-center gap-3 rounded-md border shadow-sm transition-all duration-200',

		// Size-specific styles.
		{
			'px-2 py-1': smallLabels,
			'px-3 py-1': ! smallLabels
		},

		// State-specific styles. Exclude uses the same neutral surface as include —
		// red is reserved for errors.
		{
			'cursor-not-allowed border-gray-200 bg-gray-100 text-text-gray opacity-60': disabled,
			'cursor-pointer border-green-300 bg-white shadow-md ring-1 ring-green-300': ! disabled && isHighlighted,
			'cursor-pointer border-gray-300 bg-white hover:bg-gray-50 hover:shadow-ringSubtle': ! disabled && ! isHighlighted
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

	/**
	 * Builds the hover tooltip content: dimension + operator header, the full
	 * list of selected values, a plain-language matching explanation, and a
	 * "Click to edit" hint.
	 *
	 * @return {JSX.Element} The tooltip content.
	 */
	const renderValuesTooltip = () => {
		const matchingDescription =
			FILTER_OPERATOR_TOOLTIP_DESCRIPTIONS[filter.operator] ||
			FILTER_OPERATOR_TOOLTIP_DESCRIPTIONS.is;

		return (
			<div className="flex flex-col gap-2">
				<p className="font-medium text-text-black">
					{ filter.config.label } { operatorLabel }
				</p>
				<ul className="flex max-h-48 flex-col gap-0.5 overflow-y-auto">
					{ filter.values.map( ( item ) => (
						<li key={item.raw} className="truncate text-text-gray-light">
							{ item.display }
						</li>
					) ) }
				</ul>
				<p className="text-xs text-text-gray">
					{ matchingDescription }
				</p>
				<p className="text-xs text-text-gray">
					{ __( 'Click to edit', 'burst-statistics' ) }
				</p>
			</div>
		);
	};

	const tooltipContent = disabled ? '' : renderValuesTooltip();
	const chip = (
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
		>
			{/* Filter Icon */}
			<Icon name={filter.config.icon} size={iconSize} className="text-text-gray-light" />

			{/* Label (top) + operator/value (bottom), like the DateRange trigger's preset label + dates. */}
			<span className="flex flex-col">
				<span className={clsx( 'w-full text-left text-text-gray', smallLabels ? 'text-[10px]' : 'text-xs' )}>
					{filter.config.label}
				</span>
				<span className={clsx( 'flex w-full items-center gap-1 text-left font-medium text-text-gray', smallLabels ? 'text-xs' : 'text-sm' )}>
					<span>
						{operatorLabel}{' '}
						{getValueLabel()}
					</span>
				</span>
			</span>


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

	if ( disabled ) {
		return chip;
	}

	return (
		<Tooltip content={tooltipContent}>
			{chip}
		</Tooltip>
	);
};

export default FilterChip;
