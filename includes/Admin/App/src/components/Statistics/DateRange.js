import { useCallback, useMemo, useRef, useState } from 'react';
import { DateRangePicker } from 'react-date-range';
import { format, parseISO } from 'date-fns';
import Icon from '@/utils/Icon';
import { useDateRange } from '@/hooks/useDateRange';
import {
	getDateWithOffset,
	getAvailableRanges,
	getDisplayDates,
	availableRanges
} from '@/utils/formatting';
import * as ReactPopover from '@radix-ui/react-popover';
import useShareableLinkStore from '@/store/useShareableLinkStore';

// Extract configuration
const DATE_FORMAT = 'yyyy-MM-dd';
const MIN_DATE = new Date( 2022, 0, 1 );
const CLICKS_TO_CLOSE = 2;

/**
 * Date Range Trigger Component
 *
 * @param {Object}   props           Component props
 * @param {string}   props.range     Selected range
 * @param {Object}   props.display   Display dates
 * @param {boolean}  props.isOpen    Is popover open
 * @param {Function} props.setIsOpen Function to set popover open state
 * @param {boolean} props.disabled if the trigger is disabled
 * @return {JSX.Element} Date Range Trigger
 */
const DateRangeTrigger = ({ range, display, isOpen, setIsOpen, disabled }) => (
	<ReactPopover.Trigger
		className={`burst-date-button flex min-w-[200px] items-center gap-2 rounded-md border px-3 py-2 shadow-sm transition-all duration-200 ${
			disabled ?
				'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-800 opacity-60' :
				'border-gray-300 bg-white hover:bg-gray-50 hover:[box-shadow:0_0_0_3px_rgba(0,0,0,0.05)]'
		}`}
		onClick={() => ! disabled && setIsOpen( ! isOpen )}
		disabled={disabled}
	>
		<Icon name="calendar" size="18" />

		<span className="w-full text-base">
			{'custom' === range ?
				`${display.startDate} - ${display.endDate}` :
				availableRanges[range].label}
		</span>

		<Icon name="chevron-down" />
	</ReactPopover.Trigger>
);

const DateRange = () => {
	const userCanFilterDateRange = useShareableLinkStore( ( state ) => state.userCanFilterDateRange );

	const [ isOpen, setIsOpen ] = useState( false );
	const { startDate, endDate, setDateRange, range } = useDateRange();

	const [ selectionRange, setSelectionRange ] = useState({
		startDate: parseISO( startDate ),
		endDate: parseISO( endDate ),
		key: 'selection'
	});

	const countClicks = useRef( 0 );
	const selectedRanges = burst_settings.date_ranges;

	// Memoize computed values.
	const dateRanges = useMemo(
		() => getAvailableRanges( selectedRanges ),
		[ selectedRanges ]
	);

	const display = useMemo(
		() => getDisplayDates( startDate, endDate ),
		[ startDate, endDate ]
	);

	const updateDateRange = useCallback(
		( ranges ) => {
			if ( ! userCanFilterDateRange ) {
return;
}

			try {
				countClicks.current++;
				const { startDate: newStartDate, endDate: newEndDate } = ranges.selection;

				const startStr = format( newStartDate, DATE_FORMAT );
				const endStr = format( newEndDate, DATE_FORMAT );

				setSelectionRange({
					startDate: parseISO( startStr ),
					endDate: parseISO( endStr ),
					key: 'selection'
				});

				const selectedRangeKey = Object.keys( availableRanges ).find(
					( key ) => availableRanges[key].isSelected( ranges.selection )
				);
				const newRange = selectedRangeKey || 'custom';

				const shouldClose =
					countClicks.current === CLICKS_TO_CLOSE ||
					'custom' !== newRange ||
					startStr !== endStr;

				if ( shouldClose ) {
					countClicks.current = 0;
					setDateRange( newRange, startStr, endStr );
					setIsOpen( false );
				}
			} catch ( error ) {
				console.error( 'Error updating date range:', error );
			}
		},
		[ setDateRange, userCanFilterDateRange ]
	);

	return (
		<div className="ml-auto w-auto">
			<ReactPopover.Root
				open={isOpen && userCanFilterDateRange }
				onOpenChange={( open ) => userCanFilterDateRange && setIsOpen( open )}
			>
				<DateRangeTrigger
					range={range}
					display={display}
					isOpen={isOpen}
					setIsOpen={setIsOpen}
					disabled={! userCanFilterDateRange}
				/>

				<div className="burst-date-range-popover-container relative z-[2]">
					<ReactPopover.Portal
						container={document.querySelector(
							'.burst-date-range-popover-container'
						)}
					>
						<ReactPopover.Content
							align="end"
							sideOffset={10}
							arrowPadding={10}
							id="burst-statistics"
						>
							<span className="absolute right-4 mt-1 h-4 w-4 -translate-y-2 rotate-45 transform bg-green-light" />

							<div className="z-50 rounded-lg border border-gray-200 bg-white shadow-md">
								<DateRangePicker
									ranges={[ selectionRange ]}
									rangeColors={[ '#2b8133' ]}
									dateDisplayFormat="dd MMMM yyyy"
									monthDisplayFormat="MMMM"
									onChange={updateDateRange}
									inputRanges={[]}
									showSelectionPreview={true}
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

export default DateRange;
