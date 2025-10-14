import { useCallback, useMemo, useRef, useState } from 'react';
import { DateRangePicker } from 'react-date-range';
import { format, parseISO } from 'date-fns';
import Icon from '@/utils/Icon';
import { useDate } from '@/store/useDateStore';
import {
  getDateWithOffset,
  getAvailableRanges,
  getDisplayDates,
  availableRanges
} from '@/utils/formatting';
import * as ReactPopover from '@radix-ui/react-popover';

// Extract configuration
const DATE_FORMAT = 'yyyy-MM-dd';
const MIN_DATE = new Date( 2022, 0, 1 );
const CLICKS_TO_CLOSE = 2;

// Separate trigger button component
const DateRangeTrigger = ({ range, display, isOpen, setIsOpen }) => (
  <ReactPopover.Trigger
    className="burst-date-button flex min-w-[200px] items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm transition-all duration-200 hover:bg-gray-50 hover:[box-shadow:0_0_0_3px_rgba(0,0,0,0.05)]"
    onClick={() => setIsOpen( ! isOpen )}
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
  const [ isOpen, setIsOpen ] = useState( false );
  const { startDate, endDate, setStartDate, setEndDate, setRange, range } =
    useDate();

  const [ selectionRange, setSelectionRange ] = useState({
    startDate: parseISO( startDate ),
    endDate: parseISO( endDate ),
    key: 'selection'
  });

  const countClicks = useRef( 0 );
  const selectedRanges = burst_settings.date_ranges;

  // Memoize computed values
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
      try {
        countClicks.current++;
        const { startDate, endDate } = ranges.selection;

        const startStr = format( startDate, DATE_FORMAT );
        const endStr = format( endDate, DATE_FORMAT );

        setSelectionRange({
          startDate: parseISO( startStr ),
          endDate: parseISO( endStr ),
          key: 'selection'
        });

        const selectedRangeKey = Object.keys( availableRanges ).find( ( key ) =>
          availableRanges[key].isSelected( ranges.selection )
        );
        const newRange = selectedRangeKey || 'custom';

        const shouldClose =
          countClicks.current === CLICKS_TO_CLOSE ||
          'custom' !== newRange ||
          startStr !== endStr;

        if ( shouldClose ) {
          countClicks.current = 0;
          setStartDate( startStr );
          setEndDate( endStr );
          setRange( newRange );
          setIsOpen( false );
        }
      } catch ( error ) {
        console.error( 'Error updating date range:', error );

        // Could add error handling UI here if needed
      }
    },
    [ setStartDate, setEndDate, setRange ]
  );

  return (
    <div className="ml-auto w-auto">
      <ReactPopover.Root open={isOpen} onOpenChange={setIsOpen}>
        <DateRangeTrigger
          range={range}
          display={display}
          isOpen={isOpen}
          setIsOpen={setIsOpen}
        />
        <ReactPopover.Portal container={document.querySelector( '.burst' )}>
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
                rangeColors={[ '#2B8133' ]}
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
      </ReactPopover.Root>
    </div>
  );
};

export default DateRange;
