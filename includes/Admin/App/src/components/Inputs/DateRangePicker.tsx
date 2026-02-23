import { useCallback, useMemo, useRef, useState } from 'react';
import { DateRangePicker as ReactDateRangePicker, Range, RangeKeyDict } from 'react-date-range';
import { format, parseISO } from 'date-fns';
import { clsx } from 'clsx';
import Icon from '@/utils/Icon';
import {
	getDateWithOffset,
	getAvailableRanges,
	getDisplayDates,
	availableRanges
} from '@/utils/formatting';
import * as ReactPopover from '@radix-ui/react-popover';

/**
 * Type definition for available range configuration.
 */
interface RangeConfig {
	label: string;
	range: () => { startDate: Date; endDate: Date };
	isSelected?: ( range: Range ) => boolean;
}

/**
 * Type definition for available ranges object.
 */
type AvailableRangesType = Record<string, RangeConfig>;

// Extract configuration.
const DATE_FORMAT = 'yyyy-MM-dd';
const MIN_DATE = new Date( 2022, 0, 1 );
const CLICKS_TO_CLOSE = 2;

/**
 * Date range value interface.
 */
export interface DateRangeValue {
	range: string;
	startDate: string;
	endDate: string;
}

/**
 * Date Range Picker Component Props.
 */
export interface DateRangePickerProps {

	// Controlled component props (optional).
	value?: DateRangeValue;
	onChange?: ( range: string, startDate: string, endDate: string ) => void;

	// Optional range filtering - if provided, only show these ranges.
	availableRangeKeys?: string[];

	// UI customization.
	disabled?: boolean;
	className?: string;
	align?: 'start' | 'center' | 'end';
	smallLabels?: boolean;
}

/**
 * Date Range Trigger Component.
 *
 * @param {Object}   props            Component props.
 * @param {string}   props.range      Selected range.
 * @param {Object}   props.display    Display dates.
 * @param {boolean}  props.isOpen     Is popover open.
 * @param {Function} props.setIsOpen  Function to set popover open state.
 * @param {boolean}  props.disabled   If the trigger is disabled.
 * @param {boolean}  props.smallLabels Whether to use small size styling (px-2 py-1 text-xs).
 * @return {JSX.Element} Date Range Trigger.
 */
const DateRangeTrigger = ({ range, display, isOpen, setIsOpen, disabled, smallLabels = false }: {
	range: string;
	display: { startDate: string; endDate: string };
	isOpen: boolean;
	setIsOpen: ( open: boolean ) => void;
	disabled: boolean;
	smallLabels?: boolean;
}) => {
	const iconSize = smallLabels ? 14 : 18;
	const chevronSize = smallLabels ? 14 : 16;

	return (
		<ReactPopover.Trigger
			className={clsx(
				'burst-date-button flex min-w-[200px] items-center gap-2 rounded-md border shadow-sm transition-all duration-200',

				// Size-specific styles.
				{
					'px-2 py-1 text-sm': smallLabels,
					'px-3 py-2 text-base': ! smallLabels
				},

				// State-specific styles.
				{
					'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-800 opacity-60': disabled,
					'border-gray-300 bg-white hover:bg-gray-50 hover:[box-shadow:0_0_0_3px_rgba(0,0,0,0.05)]': ! disabled
				}
			)}
			onClick={() => ! disabled && setIsOpen( ! isOpen )}
			disabled={disabled}
		>
			<Icon name="calendar" size={iconSize} />

			<span className="w-full">
				{'custom' === range ?
					`${display.startDate} - ${display.endDate}` :
					( availableRanges as AvailableRangesType )[range]?.label || range}
			</span>

			<Icon name="chevron-down" size={chevronSize} />
		</ReactPopover.Trigger>
	);
};

/**
 * Date Range Picker Component.
 *
 * Can work as a controlled or uncontrolled component.
 * When value and onChange are provided, it works in controlled mode.
 *
 * @param {DateRangePickerProps} props Component props.
 * @return {JSX.Element} Date Range Picker.
 */
export const DateRangePicker = ({
	value,
	onChange,
	availableRangeKeys,
	disabled = false,
	className = '',
	align = 'end',
	smallLabels = false
}: DateRangePickerProps ) => {
	const [ isOpen, setIsOpen ] = useState( false );

	// Use controlled value or default.
	const currentRange = value?.range || 'last-7-days';
	const currentStartDate = value?.startDate || format( new Date(), DATE_FORMAT );
	const currentEndDate = value?.endDate || format( new Date(), DATE_FORMAT );

	const [ selectionRange, setSelectionRange ] = useState({
		startDate: parseISO( currentStartDate ),
		endDate: parseISO( currentEndDate ),
		key: 'selection'
	});

	const countClicks = useRef( 0 );

	// Determine which ranges to show.
	const selectedRanges = availableRangeKeys || Object.keys( availableRanges );

	// Memoize computed values.
	const dateRanges = useMemo(
		() => getAvailableRanges( selectedRanges ),
		[ selectedRanges ]
	);

	const display = useMemo(
		() => getDisplayDates( currentStartDate, currentEndDate ),
		[ currentStartDate, currentEndDate ]
	);

	const updateDateRange = useCallback(
		( ranges: RangeKeyDict ) => {
			if ( disabled ) {
				return;
			}

			try {
				countClicks.current++;
				const selection = ranges.selection;
				if ( ! selection ) {
					return;
				}

				const { startDate: newStartDate, endDate: newEndDate } = selection;

				const startStr = format( newStartDate as Date, DATE_FORMAT );
				const endStr = format( newEndDate as Date, DATE_FORMAT );

				setSelectionRange({
					startDate: parseISO( startStr ),
					endDate: parseISO( endStr ),
					key: 'selection'
				});

				const typedRanges = availableRanges as AvailableRangesType;
				const selectedRangeKey = Object.keys( typedRanges ).find(
					( key ) => typedRanges[key].isSelected?.( selection )
				);
				const newRange = selectedRangeKey || 'custom';

				const shouldClose =
					countClicks.current === CLICKS_TO_CLOSE ||
					'custom' !== newRange ||
					startStr !== endStr;

				if ( shouldClose ) {
					countClicks.current = 0;

					// Call onChange callback if provided and value changed.
					if ( onChange ) {
						onChange( newRange, startStr, endStr );
					}

					setIsOpen( false );
				}
			} catch ( error ) {
				console.error( 'Error updating date range:', error );
			}
		},
		[ disabled, onChange ]
	);

	return (
		<div className={`ml-auto w-auto ${className}`}>
			<ReactPopover.Root
				open={isOpen && ! disabled}
				onOpenChange={( open ) => ! disabled && setIsOpen( open )}
			>
				<DateRangeTrigger
					range={currentRange}
					display={display}
					isOpen={isOpen}
					setIsOpen={setIsOpen}
					disabled={disabled}
					smallLabels={smallLabels}
				/>

				<div className="burst-date-range-popover-container relative z-[2]">
					<ReactPopover.Portal
						container={document.querySelector(
							'.burst-date-range-popover-container'
						)}
					>
						<ReactPopover.Content
							align={align}
							sideOffset={10}
							arrowPadding={10}
							id="burst-statistics"
						>
							<span className="absolute right-4 mt-1 h-4 w-4 -translate-y-2 rotate-45 transform bg-green-light" />

							<div className="z-50 rounded-lg border border-gray-200 bg-white shadow-md">
								<ReactDateRangePicker
									ranges={[ selectionRange ]}
									rangeColors={[ '#2b8133' ]}
									dateDisplayFormat="dd MMMM yyyy"
									monthDisplayFormat="MMMM"
									onChange={updateDateRange}
									inputRanges={[]}
									months={2}
									direction="horizontal"
									minDate={MIN_DATE}
									maxDate={getDateWithOffset()}
									staticRanges={dateRanges}
								/>
							</div>
						</ReactPopover.Content>
					</ReactPopover.Portal>
				</div>
			</ReactPopover.Root>
		</div>
	);
};

export default DateRangePicker;
