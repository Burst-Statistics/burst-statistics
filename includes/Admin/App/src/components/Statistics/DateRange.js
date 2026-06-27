import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format, isSameDay, parseISO } from 'date-fns';
import Icon from '@/utils/Icon';
import { useDateRange } from '@/hooks/useDateRange';
import {
	getDateWithOffset,
	getAvailableRanges,
	getDisplayDates,
	getDatePickerLocale,
	availableRanges,
	BURST_START_DATE
} from '@/utils/formatting';
import * as ReactPopover from '@radix-ui/react-popover';
import useShareableLinkStore from '@/store/useShareableLinkStore';

import DateRangePicker from '../Statistics/DateRangePicker';
import { __ } from '@wordpress/i18n';

// Extract configuration
const DATE_FORMAT = 'yyyy-MM-dd';
const CLICKS_TO_CLOSE = 2;

/**
 * Custom hook to detect mobile viewport size
 */
const useIsMobile = () => {
	const [ isMobile, setIsMobile ] = useState( () => 'undefined' !== typeof window && 1024 > window.innerWidth );
	useEffect( () => {
		const handleResize = () => {
			setIsMobile( 1024 > window.innerWidth );
		};
		window.addEventListener( 'resize', handleResize );
		return () => window.removeEventListener( 'resize', handleResize );
	}, []);
	return isMobile;
};

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
		className={`burst-date-button flex min-w-[200px] items-center gap-2 rounded-md border px-3 py-1 shadow-sm transition-all duration-200 ${disabled ?
				'cursor-not-allowed border-gray-200 bg-gray-100 text-text-gray opacity-60' :
				isOpen ?
					'border-green-300 bg-white shadow-md ring-1 ring-green-300' :
					'border-gray-300 bg-white hover:bg-gray-50 hover:shadow-ringSubtle'
			}`}
		onClick={() => ! disabled && setIsOpen( ! isOpen )}
		disabled={disabled}
	>
		<Icon name="calendar" size="20" className='text-text-gray-light' />

		<span className='flex flex-col px-2'>
			<span className='w-full text-xs text-text-gray text-left'>
				{'custom' === range || ! availableRanges[range] ?  __( 'Custom', 'burst-statistics' ) : availableRanges[range].label}
			</span>
			<span className="w-full text-sm text-text-gray font-medium text-left">
				{display.startDate} - {display.endDate}
			</span>
		</span>

		<Icon name="chevron-down" className='text-text-gray' />
	</ReactPopover.Trigger>
);

const DateRange = () => {
	const userCanFilterDateRange = useShareableLinkStore( ( state ) => state.userCanFilterDateRange );

	const [ isOpen, setIsOpen ] = useState( false );
	const { startDate, endDate, setDateRange, range } = useDateRange();
	const isMobile = useIsMobile();

	const [ selectionRange, setSelectionRange ] = useState({
		startDate: parseISO( startDate ),
		endDate: parseISO( endDate ),
		key: 'selection'
	});

	const countClicks = useRef( 0 );
	const selectedRanges = burst_settings.date_ranges;

	// Lock DOM scrolling when popover is open on mobile
	useEffect( () => {
		if ( ! isMobile || ! isOpen || ! userCanFilterDateRange ) {
			return;
		}

		const originalOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';

		return () => {
			document.body.style.overflow = originalOverflow;
		};
	}, [ isMobile, isOpen, userCanFilterDateRange ]);

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
					( key ) => {
						const rangeObj = availableRanges[key];
						const definedRange = rangeObj.range();
						return (
							isSameDay( ranges.selection.startDate, definedRange.startDate ) &&
							isSameDay( ranges.selection.endDate, definedRange.endDate )
						);
					}
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
			{isOpen && userCanFilterDateRange && (
				<div
					className="fixed inset-0 bg-black/30"
					style={{ zIndex: 100000 }}
				/>
			)}
			<div className="relative z-50">
			<ReactPopover.Root
				open={isOpen && userCanFilterDateRange}
				onOpenChange={( open ) => userCanFilterDateRange && setIsOpen( open )}
			>
				<DateRangeTrigger
					range={range}
					display={display}
					isOpen={isOpen}
					setIsOpen={setIsOpen}
					disabled={! userCanFilterDateRange}
				/>

				<ReactPopover.Portal>
					<ReactPopover.Content
						align="end"
						sideOffset={10}
						arrowPadding={10}
						collisionPadding={16}
						avoidCollisions={true}
						id="burst-statistics"
						style={{ zIndex: 100001 }}
					>
						<div
							className="rounded-lg border border-gray-200 bg-white shadow-md max-h-[75vh] lg:max-h-none overflow-y-auto w-full max-w-[calc(100vw-20px)] sm:max-w-none"
							style={{ WebkitOverflowScrolling: 'touch' }}
						>
							<DateRangePicker
								ranges={[ selectionRange ]}
								rangeColors={[ 'var(--color-green)' ]}
								locale={getDatePickerLocale()}
								dateDisplayFormat="dd MMMM yyyy"
								monthDisplayFormat="MMMM"
								onChange={updateDateRange}
								inputRanges={[]}
								showSelectionPreview={true}
								months={isMobile ? 1 : 2}
								direction="horizontal"
								minDate={BURST_START_DATE}
								maxDate={getDateWithOffset()}
								staticRanges={dateRanges}
							/>
						</div>
					</ReactPopover.Content>
				</ReactPopover.Portal>
			</ReactPopover.Root>
			</div>
		</div>
	);
};

export default DateRange;
