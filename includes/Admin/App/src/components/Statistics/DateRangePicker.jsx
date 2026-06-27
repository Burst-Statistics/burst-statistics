import { useEffect, useRef, useState } from 'react';
import { DateRange, DefinedRange } from 'react-date-range';
import { __ } from '@wordpress/i18n';
import CompareToggle from '../Statistics/CompareToggle';
import Icon from '@/utils/Icon';

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
 * Find the next non-disabled range index, matching react-date-range's helper.
 *
 * @param {Array}  ranges             List of range objects.
 * @param {number} currentRangeIndex  Index to start searching after.
 * @return {number} Index of the next focusable range (or the first valid one).
 */
const findNextRangeIndex = ( ranges = [], currentRangeIndex = -1 ) => {
	const nextIndex = ranges.findIndex(
		( range, i ) =>
			i > currentRangeIndex && false !== range.autoFocus && ! range.disabled
	);
	if ( -1 !== nextIndex ) {
		return nextIndex;
	}
	return ranges.findIndex(
		( range ) => false !== range.autoFocus && ! range.disabled
	);
};

/**
 * Custom DateRangePicker.
 *
 * Drop-in replacement for `react-date-range`'s `DateRangePicker` that composes
 * `DefinedRange` (preset sidebar) and `DateRange` (calendar) so we can add
 * section headings between them for a clearer UI.
 *
 * The wiring (focused range state, preview updates via the calendar ref)
 * mirrors the upstream implementation:
 * @see https://github.com/hypeserver/react-date-range/blob/master/src/components/DateRangePicker/index.js
 *
 * @param {Object} props                       Component props (passed through to both subcomponents).
 * @param {Array}  props.ranges                The selected ranges.
 * @param {string} [props.presetsHeading]      Optional override for the presets heading.
 * @param {string} [props.calendarHeading]     Optional override for the calendar heading.
 * @param {string} [props.className]           Optional wrapper className.
 * @return {JSX.Element} Rendered date range picker.
 */
const DateRangePicker = ({
	presetsHeading,
	calendarHeading,
	className = '',
	...props
}) => {
	const { ranges = [] } = props;
	const isMobile = useIsMobile();
	const [ isPresetsExpanded, setIsPresetsExpanded ] = useState( false );

	const [ focusedRange, setFocusedRange ] = useState([
		findNextRangeIndex( ranges ),
		0
	]);

	// Ref to the underlying DateRange instance so DefinedRange can drive
	// the hover-preview behaviour, as the original DateRangePicker does.
	const dateRangeRef = useRef( null );

	const handlePreviewChange = ( value ) => {
		const instance = dateRangeRef.current;
		if ( ! instance ) {
			return;
		}
		instance.updatePreview(
			value ?
				instance.calcNewSelection( value, 'string' === typeof value ) :
				null
		);
	};

	return (
		<div className={`burst-date-range-picker ${className}`.trim()}>
			<div className="flex flex-col lg:flex-row">
				<div className="flex flex-col border-b lg:border-b-0 lg:border-r border-gray-200 min-w-3xs pb-2 lg:pb-0">
					<button
						type="button"
						onClick={() => isMobile && setIsPresetsExpanded( ! isPresetsExpanded )}
						className={`flex w-full items-center justify-between px-4 pt-4 pb-2 text-left text-md font-medium select-none ${isMobile ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default pointer-events-none'}`}
						tabIndex={isMobile ? 0 : -1}
					>
						<span>{presetsHeading ?? __( 'Quick select', 'burst-statistics' )}</span>
						{isMobile && (
							<Icon
								name={isPresetsExpanded ? 'chevron-up' : 'chevron-down'}
								size={16}
								className="text-text-gray"
							/>
						)}
					</button>
					{( ! isMobile || isPresetsExpanded ) && (
						<DefinedRange
							{...props}
							focusedRange={focusedRange}
							onPreviewChange={handlePreviewChange}
							range={ranges[focusedRange[0]]}
							className={'w-full'}
						/>
					)}
				</div>
				<div className="flex flex-col pb-4 max-w-full">
					<h3 className="text-md font-medium px-4 pt-4 pb-2">
						{calendarHeading ?? __( 'Custom range', 'burst-statistics' )}
					</h3>
					<DateRange
						{...props}
						ref={dateRangeRef}
						focusedRange={focusedRange}
						onRangeFocusChange={setFocusedRange}
						className={'mx-2 lg:mx-4 border border-gray-200 rounded-md max-w-full self-center lg:self-auto'}
					/>
					<CompareToggle />
				</div>
			</div>
		</div>
	);
};

export default DateRangePicker;
