
import {useCallback, useMemo, useRef, useState} from '@wordpress/element';
import {DateRangePicker} from 'react-date-range';
import {
  format,
  parseISO
} from 'date-fns';
import Icon from '../../utils/Icon';
import {useDate} from '../../store/useDateStore';
import {
  getDateWithOffset,
  getAvailableRanges,
  getDisplayDates,
  availableRanges
} from '../../utils/formatting';
import * as ReactPopover from '@radix-ui/react-popover';

const DateRange = ( props ) => {
  const [ isOpen, setIsOpen ] = useState( false );
const {
  startDate,
  endDate,
  setStartDate,
  setEndDate,
  setRange,
  range
} = useDate();
  const [ selectionRangeStartDate, setSelectionRangeStartDate ] = useState(
      parseISO( startDate ) );
  const [ selectionRangeEndDate, setSelectionRangeEndDate ] = useState(
      parseISO( endDate ) );
  const countClicks = useRef( 0 );
  const selectedRanges = burst_settings.date_ranges;
  const dateRanges = useMemo( () => getAvailableRanges( selectedRanges ),
      [ selectedRanges ]);
  const display = getDisplayDates( startDate, endDate );

  const updateDateRange = useCallback( ( ranges ) => {
    countClicks.current++;

    const {startDate, endDate} = ranges.selection;
    const startStr = format( startDate, 'yyyy-MM-dd' );
    const endStr = format( endDate, 'yyyy-MM-dd' );

    setSelectionRangeStartDate( parseISO( startStr ) );
    setSelectionRangeEndDate( parseISO( endStr ) );

    const selectedRangeKey = Object.keys( availableRanges ).find( key =>
        availableRanges[key].isSelected( ranges.selection )
    );
    const range = selectedRangeKey || 'custom';

    const isSecondClick = 2 === countClicks.current;
    const isRange = 'custom' !== range;
    const isTwoDifferentDates = startStr !== endStr;

    if ( isSecondClick || isRange || isTwoDifferentDates ) {
      countClicks.current = 0;
      setStartDate( startStr );
      setEndDate( endStr );
      setRange( range );
      setIsOpen( false );
    }
  }, [ setStartDate, setEndDate, setRange ]);
  const selectionRange = {
    startDate: selectionRangeStartDate,
    endDate: selectionRangeEndDate,
    key: 'selection'
  };
  return (
      <div className="burst-date-range-container">
        <ReactPopover.Root open={isOpen} onOpenChange={setIsOpen}>
          <ReactPopover.Trigger
              id="burst-date-range-picker-open-button"
              className={'burst-button burst-button--secondary burst-button--date-range'}
              onClick={() => setIsOpen( ! isOpen )}
          >
            <Icon name="calendar" size={'18'}/>

            {'custom' === range && display.startDate + ' - ' +
                display.endDate}
            {'custom' !== range && availableRanges[range].label}
            <Icon name="chevron-down"/>
          </ReactPopover.Trigger>
          <ReactPopover.Portal>
            <ReactPopover.Content
                className={'burst burst-popover burst-popover--date-range'}
                id={'burst-date-range-picker-container'}
                align={'end'}
                sideOffset={10}
                arrowPadding={10}
            >
              <span className={'burst-popover__arrow'}></span>
              <DateRangePicker
                  ranges={[ selectionRange ]}
                  rangeColors={[ 'var(--rsp-brand-primary)' ]}
                  dateDisplayFormat={'dd MMMM yyyy'}
                  monthDisplayFormat="MMMM"
                  onChange={( ranges ) => {
updateDateRange( ranges );
}}
                  inputRanges={[]}
                  showSelectionPreview={true}
                  months={2}
                  direction="horizontal"
                  minDate={new Date( 2022, 0, 1 )}
                  maxDate={getDateWithOffset()}
                  staticRanges={dateRanges}
              />
            </ReactPopover.Content>
          </ReactPopover.Portal>
        </ReactPopover.Root>
      </div>
  );

};

export default DateRange;
