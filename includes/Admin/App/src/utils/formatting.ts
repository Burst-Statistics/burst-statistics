import { dateI18n, getSettings } from '@wordpress/date';
import {
	addDays,
	addMonths,
	addYears,
	endOfDay,
	endOfMonth,
	endOfYear,
	isSameDay,
	startOfDay,
	startOfMonth,
	startOfYear
} from 'date-fns';
import type { Locale } from 'date-fns';
import enUS from 'date-fns/locale/en-US';
import { __ } from '@wordpress/i18n';

/**
 * Runtime global injected by `wp_localize_script` in
 * `includes/Admin/App/class-app.php`. Declared here so this module can read
 * the same data without going through `window.burst_settings` at every call.
 */
declare const burst_settings: {
	date_format: string;
	time_format: string;
	gmt_offset: number | string;
	countries: Record<string, string>;
	continents: Record<string, string>;
	burst_date_picker_start_date?: number | string;
	burst_activation_time?: number | string;
	locale?: string;
	[key: string]: unknown;
};

const getLocale = (): string | undefined => {
	if ( 'undefined' !== typeof burst_settings && burst_settings.locale ) {
		return burst_settings.locale;
	}
	return undefined;
};

/** Units supported by `getRelativeTime`, in descending order of size. */
type RelativeUnit = 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second';

/** Result returned by the change-percentage helpers. */
export interface ChangePercentage {
	val: string;
	status: 'positive' | 'negative';
}

/** A start/end date pair used by the preset ranges. */
export interface DateRangeValue {
	startDate: Date;
	endDate: Date;
}

/**
 * Looser shape used when comparing against an arbitrary range. This matches
 * `react-date-range`'s `Range`, which allows `undefined` start/end dates.
 */
export interface DateRangeLike {
	startDate?: Date;
	endDate?: Date;
}

/** A single preset range definition (label + range factory). */
export interface RangeDefinition {
	label: string;
	range: () => DateRangeValue;
	isSelected?: ( range: DateRangeLike ) => boolean;
}

/** Per-metric formatting options consumed by `createValueFormatter`. */
export interface MetricOption {
	isPercentage?: boolean;
	isTime?: boolean;
	precision?: number;
	suffix?: string;
}

/** Grouping interval understood by the chart axis/tooltip formatters. */
export type ChartInterval = 'hour' | 'day' | 'week' | 'month' | 'year';

/**
 * Returns a formatted string that represents the relative time between two dates.
 *
 * @param relativeDate - The date to compare, or a UTC timestamp (seconds).
 * @param date         - The reference date, defaults to the current date.
 * @return The relative time string.
 */
const getRelativeTime = (
	relativeDate: Date | number,
	date: Date = new Date()
): string => {
	let target: Date;

	// If `relativeDate` is a number we assume it is a UTC timestamp in seconds.
	if ( 'number' === typeof relativeDate ) {
		target = new Date( relativeDate * 1000 );
	} else {
		target = relativeDate;
	}

	if ( ! ( target instanceof Date ) ) {

		// Invalid date, probably still loading.
		return '-';
	}

	const units: Record<RelativeUnit, number> = {
		year: 24 * 60 * 60 * 1000 * 365,
		month: ( 24 * 60 * 60 * 1000 * 365 ) / 12,
		day: 24 * 60 * 60 * 1000,
		hour: 60 * 60 * 1000,
		minute: 60 * 1000,
		second: 1000
	};
	const rtf = new Intl.RelativeTimeFormat( 'en', { numeric: 'auto' });
	const elapsed = target.getTime() - date.getTime();

	// `Math.abs` accounts for both past and future scenarios.
	for ( const u of Object.keys( units ) as RelativeUnit[]) {
		if ( Math.abs( elapsed ) > units[u] || 'second' === u ) {
			return rtf.format( Math.round( elapsed / units[u]), u );
		}
	}

	return '-';
};

/**
 * Calculates the percentage of a value from the total.
 *
 * @param val          - The value to calculate the percentage of.
 * @param total        - The total value.
 * @param shouldFormat - If true returns a formatted string, otherwise the raw ratio.
 * @return The formatted percentage or the raw percentage.
 */
function getPercentage(
	val: number | string,
	total: number | string,
	shouldFormat: boolean = true
): string | number {
	const numericVal = Number( val );
	const numericTotal = Number( total );
	let percentage = numericVal / numericTotal;
	if ( isNaN( percentage ) ) {
		percentage = 0;
	}
	return shouldFormat ?
		new Intl.NumberFormat( undefined, {
			style: 'percent',
			maximumFractionDigits: 1
		}).format( percentage ) :
		percentage;
}

/**
 * Formats a signed ratio as an arrow-prefixed percentage label (e.g. "↑ 11.6%").
 *
 * @param percentage - Signed ratio (0.116 = 11.6% increase).
 * @return Arrow-prefixed percentage string.
 */
function formatChangeLabelWithArrow( percentage: number ): string {
	const formatted = new Intl.NumberFormat( undefined, {
		style: 'percent',
		maximumFractionDigits: 1
	}).format( Math.abs( percentage ) );

	if ( 0 === percentage ) {
		return `↑ ${ formatted }`;
	}

	const direction = 0 < percentage ? '↑' : '↓';

	return `${ direction } ${ formatted }`;
}

/**
 * Calculates the percentage change between two values.
 *
 * @param currValue - The current value.
 * @param prevValue - The previous value.
 * @return Formatted percentage with a positive/negative status.
 */
function getChangePercentage(
	currValue: number | string,
	prevValue: number | string
): ChangePercentage {
	const curr = Number( currValue );
	const prev = Number( prevValue );

	let percentage = ( curr - prev ) / prev;
	if ( isNaN( percentage ) ) {
		percentage = 0;
	}

	const change: ChangePercentage = {
		val: formatChangeLabelWithArrow( percentage ),
		status: 0 < percentage ? 'positive' : 'negative'
	};

	if ( percentage === Infinity ) {
		change.val = '';
		change.status = 'positive';
	}

	return change;
}

/**
 * Like `getChangePercentage`, but treats the input as an absolute delta that
 * should be divided by 100 to obtain a ratio.
 *
 * @param currValue - The current value.
 * @param prevValue - The previous value.
 * @return Formatted percentage with a positive/negative status.
 */
function getAbsoluteChangePercentage(
	currValue: number | string,
	prevValue: number | string
): ChangePercentage {
	const curr = Number( currValue );
	const prev = Number( prevValue );

	let percentage = ( curr - prev ) / 100;
	if ( isNaN( percentage ) ) {
		percentage = 0;
	}

	const change: ChangePercentage = {
		val: formatChangeLabelWithArrow( percentage ),
		status: 0 < percentage ? 'positive' : 'negative'
	};

	if ( percentage === Infinity ) {
		change.val = '';
		change.status = 'positive';
	}

	return change;
}

/**
 * Calculates the bounce percentage from bounced and total sessions.
 *
 * @param bounced_sessions - The number of bounced sessions.
 * @param sessions         - The total number of sessions.
 * @param shouldFormat     - If true returns a formatted string, otherwise the raw ratio.
 * @return The formatted bounce percentage or the raw bounce percentage.
 */
function getBouncePercentage(
	bounced_sessions: number | string,
	sessions: number | string,
	shouldFormat: boolean = true
): string | number {
	const bounced = Number( bounced_sessions );
	const total = Number( sessions );
	return getPercentage( bounced, total + bounced, shouldFormat );
}

/**
 * Formats a Unix timestamp as a date string using the site's locale and WP date format.
 *
 * @param unixTimestamp - The Unix timestamp in seconds.
 * @return The formatted date string.
 */
const formatUnixToDate = ( unixTimestamp: number ): string => {
	return dateI18n(
		burst_settings.date_format,
		new Date( unixTimestamp * 1000 ),
		undefined
	);
};

/**
 * Formats a Unix timestamp as a localized time string.
 *
 * @param unixTimestamp - Unix timestamp in seconds.
 * @return Formatted short time string.
 */
const formatUnixToTime = ( unixTimestamp: number ): string => {
	const date = new Date( unixTimestamp * 1000 );

	return new Intl.DateTimeFormat( getLocale(), {
		timeZone: getWpTimezone(),
		timeStyle: 'short'
	}).format( date );
};

const DEFAULT_X_AXIS_TICK_COUNT = 7;

/**
 * Reduces a full x-axis value list to a stable, evenly spaced subset.
 * Keeps the first and last values so charts align on range boundaries.
 *
 * @param values   - Ordered x-axis values.
 * @param maxTicks - Maximum number of labels to display.
 * @return Sparse tick values.
 */
function getChartXAxisTickValues<T>(
	values: T[],
	maxTicks: number = DEFAULT_X_AXIS_TICK_COUNT
): T[] {
	if ( ! Array.isArray( values ) || 0 === values.length ) {
		return [];
	}

	if ( values.length <= maxTicks ) {
		return values;
	}

	const lastIndex = values.length - 1;
	const tickIndexes = new Set<number>([ 0, lastIndex ]);

	for ( let index = 1; index < maxTicks - 1; index++ ) {
		tickIndexes.add( Math.round( ( index * lastIndex ) / ( maxTicks - 1 ) ) );
	}

	return Array.from( tickIndexes )
		.sort( ( left, right ) => left - right )
		.map( ( index ) => values[index]);
}

/**
 * Formats a Unix timestamp as a date and time string, using the site's locale
 * and the configured WP date/time format.
 *
 * @param unixTimestamp - The Unix timestamp in seconds.
 * @return The formatted date and time string.
 */
const formatUnixToDateTime = ( unixTimestamp: number ): string => {
	return dateI18n(
		`${ burst_settings.date_format } \\a\\t ${ burst_settings.time_format }`,
		new Date( unixTimestamp * 1000 ),
		undefined
	);
};

/**
 * Check if a date value is plausibly valid (parseable and not before 2022).
 *
 * @param date - The date to check.
 * @return True if the date is valid, false otherwise.
 */
const isValidDate = ( date: string | number | null | undefined ): boolean => {

	// January 1, 2022 in Unix timestamp (milliseconds).
	const MIN_START_DATE = 1640995200 * 1000;
	return Boolean(
		date &&
			( 'number' === typeof date ||
				Date.parse( date as string ) >= MIN_START_DATE )
	);
};

/**
 * Converts a date to a Unix timestamp in milliseconds.
 *
 * @param date - The date to convert.
 * @return The Unix timestamp in milliseconds.
 */
const toUnixTimestampMillis = ( date: string | number ): number => {
	if ( 'number' === typeof date ) {

		// If the number is 10 digits long, assume it's in seconds and convert to milliseconds.
		return 10 === date.toString().length ? date * 1000 : date;
	}

	// If it's a string, parse it to get milliseconds.
	return Date.parse( date );
};

/**
 * Formats a duration given in milliseconds as a `HH:mm:ss` (or `mm:ss`) string.
 *
 * @param timeInMilliSeconds - The duration in milliseconds.
 * @return The formatted time string.
 */
function formatTime( timeInMilliSeconds: number | string = 0 ): string {
	let timeInSeconds = Number( timeInMilliSeconds );
	if ( isNaN( timeInSeconds ) ) {
		timeInSeconds = 0;
	}

	const seconds = Math.floor( timeInSeconds / 1000 );
	const hours = Math.floor( seconds / 3600 );
	const minutes = Math.floor( ( seconds - hours * 3600 ) / 60 );
	const remainingSeconds = seconds - hours * 3600 - minutes * 60;

	const zeroPad = ( num: number ): string => {
		if ( isNaN( num ) ) {
			return '00';
		}
		return String( num ).padStart( 2, '0' );
	};

	// If hours is 0, return only minutes and seconds.
	if ( 0 === hours ) {
		return [ minutes, remainingSeconds ].map( zeroPad ).join( ':' );
	}

	return [ hours, minutes, remainingSeconds ].map( zeroPad ).join( ':' );
}

/**
 * Formats a number with locale-aware grouping.
 *
 * @param value    - The number to format.
 * @param decimals - The number of decimal places to use.
 * @param compact  - When true (default), uses compact notation (e.g. 1.2K). When false, shows the full value.
 * @return The formatted number.
 */
function formatNumber( value: number | string, decimals: number = 1, compact: boolean = true ): string {
	let numeric = Number( value );
	if ( isNaN( numeric ) ) {
		numeric = 0;
	}

	// If value is smaller than 1000, return the number without decimals (compact mode only).
	let fractionDigits = decimals;
	if ( compact && 1000 > numeric ) {
		fractionDigits = 0;
	}
	if ( ! compact && Number.isInteger( numeric ) ) {
		fractionDigits = 0;
	}

	const options: Intl.NumberFormatOptions = {
		style: 'decimal',
		maximumFractionDigits: fractionDigits
	};

	if ( compact ) {
		options.notation = 'compact';
		options.compactDisplay = 'short';
	}

	return new Intl.NumberFormat( getLocale(), options ).format( numeric );
}

/**
 * Formats a percentage value with the specified number of decimal places.
 *
 * @param value    - The percentage value (not multiplied by 100).
 * @param decimals - The number of decimal places to use.
 * @return The formatted percentage.
 */
function formatPercentage( value: number | string, decimals: number = 1 ): string {
	let numeric = Number( value );
	if ( isNaN( numeric ) ) {
		numeric = 0;
	}
	if ( 0 === numeric ) {
		return '0%';
	}
	if ( 0 < numeric && 0.1 > numeric ) {
		return '<0.1%';
	}

	return new Intl.NumberFormat( getLocale(), {
		style: 'percent',
		maximumFractionDigits: decimals
	}).format( numeric / 100 );
}

/**
 * Returns the name of a country based on its country code, or a fallback.
 *
 * @param countryCode - The country code.
 * @return The country name.
 */
function getCountryName( countryCode: string | undefined | null ): string {
	if ( countryCode ) {
		return (
			burst_settings.countries[countryCode.toUpperCase()] ||
			__( 'Not set', 'burst-statistics' )
		);
	}
	return __( 'Unknown', 'burst-statistics' );
}

/**
 * Returns the name of a continent based on its continent code, or a fallback.
 *
 * @param continentCode - The continent code.
 * @return The continent name.
 */
function getContinentName( continentCode: string | undefined | null ): string {
	if ( continentCode ) {
		return (
			burst_settings.continents[continentCode.toUpperCase()] ||
			__( 'Not set', 'burst-statistics' )
		);
	}
	return __( 'Unknown', 'burst-statistics' );
}

/**
 * Returns the current date adjusted for both the WordPress GMT offset and the
 * client's timezone, so calculations align with server-side data buckets.
 *
 * @param currentDate - The date to offset, defaults to now.
 * @return Offset-adjusted date.
 */
function getDateWithOffset( currentDate: Date = new Date() ): Date {

	// Client's timezone offset in minutes.
	const clientTimezoneOffsetMinutes = currentDate.getTimezoneOffset();

	// Convert client's timezone offset from minutes to seconds.
	const clientTimezoneOffsetSeconds = clientTimezoneOffsetMinutes * -60;

	// Current unix timestamp in seconds.
	const currentUnix = Math.floor( currentDate.getTime() / 1000 );

	// Add `burst_settings.gmt_offset` hours and the client's timezone offset in
	// seconds to `currentUnix`.
	const currentUnixWithOffsets =
		currentUnix +
		Number( burst_settings.gmt_offset ) * 3600 -
		clientTimezoneOffsetSeconds;

	return new Date( currentUnixWithOffsets * 1000 );
}
const currentDateWithOffset = getDateWithOffset();

const DEFAULT_BURST_START_TIMESTAMP = 1640995200;

/**
 * Resolves the earliest date the date-picker should allow, based on either an
 * explicit configured value or the plugin's activation time.
 *
 * @return Start-of-day Date for the earliest selectable date.
 */
const getBurstStartDate = (): Date => {
	let activationTimestamp: number = DEFAULT_BURST_START_TIMESTAMP;
	if ( burst_settings.burst_date_picker_start_date ) {
		activationTimestamp = Number( burst_settings.burst_date_picker_start_date );
	} else if ( burst_settings.burst_activation_time ) {
		activationTimestamp = Number( burst_settings.burst_activation_time );
	}

	if ( isNaN( activationTimestamp ) ) {
		activationTimestamp = DEFAULT_BURST_START_TIMESTAMP;
	}

	const startTimestamp =
		Number.isFinite( activationTimestamp ) && 0 < activationTimestamp ?
			activationTimestamp :
			DEFAULT_BURST_START_TIMESTAMP;

	return startOfDay( getDateWithOffset( new Date( startTimestamp * 1000 ) ) );
};

export const BURST_START_DATE: Date = getBurstStartDate();

const availableRanges = {
	today: {
		get label() {
			return __( 'Today', 'burst-statistics' );
		},
		range: () => ({
			startDate: startOfDay( currentDateWithOffset ),
			endDate: endOfDay( currentDateWithOffset )
		})
	} as RangeDefinition,
	yesterday: {
		get label() {
			return __( 'Yesterday', 'burst-statistics' );
		},
		range: () => ({
			startDate: startOfDay( addDays( currentDateWithOffset, -1 ) ),
			endDate: endOfDay( addDays( currentDateWithOffset, -1 ) )
		})
	} as RangeDefinition,
	'last-7-days': {
		get label() {
			return __( 'Last 7 days', 'burst-statistics' );
		},
		range: () => ({
			startDate: startOfDay( addDays( currentDateWithOffset, -7 ) ),
			endDate: endOfDay( addDays( currentDateWithOffset, -1 ) )
		})
	} as RangeDefinition,
	'last-week': {
		get label() {
			return __( 'Last week', 'burst-statistics' );
		},
		range: () => {
			const daysFromSunday = currentDateWithOffset.getDay();
			const startOfThisWeek = addDays( currentDateWithOffset, -daysFromSunday );
			return {
				startDate: startOfDay( addDays( startOfThisWeek, -7 ) ),
				endDate: endOfDay( addDays( startOfThisWeek, -1 ) )
			};
		}
	} as RangeDefinition,
	'last-30-days': {
		get label() {
			return __( 'Last 30 days', 'burst-statistics' );
		},
		range: () => ({
			startDate: startOfDay( addDays( currentDateWithOffset, -30 ) ),
			endDate: endOfDay( addDays( currentDateWithOffset, -1 ) )
		})
	} as RangeDefinition,
	'last-90-days': {
		get label() {
			return __( 'Last 90 days', 'burst-statistics' );
		},
		range: () => ({
			startDate: startOfDay( addDays( currentDateWithOffset, -90 ) ),
			endDate: endOfDay( addDays( currentDateWithOffset, -1 ) )
		})
	} as RangeDefinition,
	'last-month': {
		get label() {
			return __( 'Last month', 'burst-statistics' );
		},
		range: () => ({
			startDate: startOfMonth( addMonths( currentDateWithOffset, -1 ) ),
			endDate: endOfMonth( addMonths( currentDateWithOffset, -1 ) )
		})
	} as RangeDefinition,
	'week-to-date': {
		get label() {
			return __( 'Week to date', 'burst-statistics' );
		},
		range: () => ({
			startDate: startOfDay(
				addDays( currentDateWithOffset, -currentDateWithOffset.getDay() )
			),
			endDate: endOfDay( currentDateWithOffset )
		})
	} as RangeDefinition,
	'month-to-date': {
		get label() {
			return __( 'Month to date', 'burst-statistics' );
		},
		range: () => ({
			startDate: startOfMonth( currentDateWithOffset ),
			endDate: endOfDay( currentDateWithOffset )
		})
	} as RangeDefinition,
	'year-to-date': {
		get label() {
			return __( 'Year to date', 'burst-statistics' );
		},
		range: () => ({
			startDate: startOfYear( currentDateWithOffset ),
			endDate: endOfDay( currentDateWithOffset )
		})
	} as RangeDefinition,
	'last-year': {
		get label() {
			return __( 'Last year', 'burst-statistics' );
		},
		range: () => ({
			startDate: startOfYear( addYears( currentDateWithOffset, -1 ) ),
			endDate: endOfYear( addYears( currentDateWithOffset, -1 ) )
		})
	} as RangeDefinition,
	'all-time': {
		get label() {
			return __( 'All time', 'burst-statistics' );
		},
		range: () => ({
			startDate: BURST_START_DATE,
			endDate: endOfDay( currentDateWithOffset )
		})
	} as RangeDefinition
};

/** Keys of the predefined preset ranges. */
export type AvailableRangeKey = keyof typeof availableRanges;

/** A `RangeDefinition` after `getAvailableRanges` has attached `isSelected`. */
export type ResolvedRangeDefinition = RangeDefinition & {
	isSelected: ( range: DateRangeLike ) => boolean;
};

/**
 * Filters `availableRanges` to the subset of keys requested by the caller and
 * attaches the shared `isSelected` predicate to each entry.
 *
 * @param selectedRanges - The list (or object) of range keys to include.
 * @return Selected ranges with `isSelected` attached.
 */
const getAvailableRanges = (
	selectedRanges:
		| ReadonlyArray<string | undefined>
		| Record<string, string | undefined>
): ResolvedRangeDefinition[] => {
	return Object.values( selectedRanges )
		.filter( ( value ): value is string => Boolean( value ) )
		.map( ( value ) => {
			const range = availableRanges[value as AvailableRangeKey];
			range.isSelected = isSelected;
			return range as ResolvedRangeDefinition;
		});
};

/**
 * Like `getAvailableRanges`, but returns the entries keyed by their range key.
 *
 * @param selectedRanges - The list of range keys to include.
 * @return Selected ranges as a keyed object.
 */
const getAvailableRangesWithKeys = (
	selectedRanges: ReadonlyArray<string>
): Partial<Record<AvailableRangeKey, RangeDefinition>> => {
	const ranges: Partial<Record<AvailableRangeKey, RangeDefinition>> = {};
	( Object.keys( availableRanges ) as AvailableRangeKey[])
		.filter( ( key ) => selectedRanges.includes( key ) )
		.forEach( ( key ) => {
			ranges[key] = {

				// Spread the properties from the range object.
				...availableRanges[key]
			};
		});
	return ranges;
};

/**
 * Formats start/end dates as localized display strings.
 *
 * @param startDate - The start date.
 * @param endDate   - The end date.
 * @return Object with formatted `startDate` and `endDate` strings.
 */
const getDisplayDates = (
	startDate: string,
	endDate: string
): { startDate: string; endDate: string } => {
	const startDateObj = new Date( startDate );
	const endDateObj = new Date( endDate );

	// if both are in the same year remove the year for startDate
	const removeYear = startDateObj.getFullYear() === endDateObj.getFullYear();

	// Format is based on user's locale.
	return {
		startDate: startDate ? formatDate( startDateObj, removeYear ) : '',
		endDate: endDate ? formatDate( endDateObj ) : ''
	};
};

/**
 * Predicate used to determine whether a given date range matches the preset
 * range it's bound to. Relies on `this` being the parent `RangeDefinition`.
 *
 * @param range - The candidate range to compare.
 * @return True if the candidate matches this preset.
 */
function isSelected( this: RangeDefinition, range: DateRangeLike ): boolean {
	const definedRange = this.range();
	return (
		undefined !== range.startDate &&
		undefined !== range.endDate &&
		isSameDay( range.startDate, definedRange.startDate ) &&
		isSameDay( range.endDate, definedRange.endDate )
	);
}

/**
 * Creates a value formatter function based on metric options.
 *
 * @param metric        - The metric key.
 * @param metricOptions - The metric options object.
 * @return A value formatter function.
 */
function createValueFormatter(
	metric: string | undefined,
	metricOptions: Record<string, MetricOption> = {}
): ( value: number | string | null | undefined ) => string {
	if ( ! metric || ! metricOptions[metric]) {
		return ( d ) => formatNumber( ( d ?? 0 ) as number | string );
	}

	const { isPercentage, isTime, precision, suffix } = metricOptions[metric];

	return ( value ) => {
		if ( null === value || value === undefined ) {
			return '';
		}

		if ( isPercentage ) {
			return formatPercentage( value, precision );
		}

		if ( isTime ) {
			return formatTime( value );
		}

		let formatted = formatNumber( value, precision );
		if ( suffix ) {
			formatted += suffix;
		}
		return formatted;
	};
}

/**
 * Formats a currency value using `Intl.NumberFormat`.
 *
 * @param currency - The currency code (e.g. `USD`, `EUR`).
 * @param value    - The currency value to format.
 * @return The formatted currency string.
 */
function formatCurrency( currency: string, value: number ): string {
	return new Intl.NumberFormat( getLocale(), {
		style: 'currency',
		currency,
		maximumFractionDigits: 2,
		minimumFractionDigits: 2,
		trailingZeroDisplay: 'stripIfInteger'
	} as Intl.NumberFormatOptions ).format( value );
}

/**
 * Formats a currency value in compact form (e.g. €100k, $2.5M).
 *
 * @param currency - The currency code (e.g. `USD`, `EUR`).
 * @param value    - The currency value to format.
 * @param args     - Additional `Intl.NumberFormat` options to merge in.
 * @return The compact formatted currency value.
 */
function formatCurrencyCompact(
	currency: string,
	value: number,
	args: Intl.NumberFormatOptions = {}
): string {
	return new Intl.NumberFormat( getLocale(), {
		style: 'currency',
		currency,
		notation: 'compact',
		compactDisplay: 'short',
		maximumFractionDigits: 1,
		...args
	}).format( value );
}

/**
 * Formats a date for display (e.g. "September 1, 2025") using
 * `Intl.DateTimeFormat` for proper localization.
 *
 * @param dateInput - The date string (YYYY-MM-DD) or Date object.
 * @param removeYear - Whether to remove the year from the date.
 * @return The formatted date string, or an empty string if invalid.
 */
function formatDate( dateInput: string | number | Date | null | undefined, removeYear: boolean = false ): string {
	if ( ! dateInput ) {
		return '';
	}

	try {
		const date = dateInput instanceof Date ? dateInput : new Date( dateInput );

		if ( isNaN( date.getTime() ) ) {
			return '';
		}

		return new Intl.DateTimeFormat( getLocale(), {
			month: 'long',
			day: 'numeric',
			year: removeYear ? undefined : 'numeric'
		}).format( date );
	} catch {
		return '';
	}
}

/**
 * Formats a date and time for display (e.g. "September 1, 2025 12:00:00")
 * using `Intl.DateTimeFormat` for proper localization.
 *
 * @param dateInput - The date string (YYYY-MM-DD) or Date object.
 * @return The formatted date string, or an empty string if invalid.
 */
function formatDateAndTime( dateInput: string | number | Date | null | undefined ): string {
	if ( ! dateInput ) {
		return '';
	}

	try {
		const date = dateInput instanceof Date ? dateInput : new Date( dateInput );

		if ( isNaN( date.getTime() ) ) {
			return '';
		}

		return new Intl.DateTimeFormat( getLocale(), {
			month: 'long',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: 'numeric',
			second: 'numeric'
		}).format( date );
	} catch {
		return '';
	}
}

/**
 * Formats a date for short display (e.g. "Dec 23, 2025") using
 * `Intl.DateTimeFormat` for proper localization.
 *
 * @param dateInput - The date string (YYYY-MM-DD) or Date object.
 * @return The formatted date string, or an empty string if invalid.
 */
function formatDateShort( dateInput: string | number | Date | null | undefined ): string {
	if ( ! dateInput ) {
		return '';
	}

	try {
		const date = dateInput instanceof Date ? dateInput : new Date( dateInput );

		if ( isNaN( date.getTime() ) ) {
			return '';
		}

		return new Intl.DateTimeFormat( getLocale(), {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		}).format( date );
	} catch {
		return '';
	}
}

/**
 * Format a duration in seconds to a human-readable string.
 *
 * Examples:
 *   0     → "0s"
 *   30    → "30s"
 *   90    → "1m 30s"
 *   120   → "2m"
 *   3600  → "1h"
 *   3660  → "1h 1m"
 *
 * @param seconds - Duration in seconds.
 * @return Human-readable duration.
 */
const formatDuration = ( seconds: number ): string => {
	if ( 0 === seconds ) {
		return '0s';
	}
	if ( 0 === seconds % 3600 ) {
		return `${ seconds / 3600 }h`;
	}
	if ( 0 === seconds % 60 ) {
		return `${ seconds / 60 }m`;
	}
	if ( 60 > seconds ) {
		return `${ seconds }s`;
	}
	const m = Math.floor( seconds / 60 );
	const s = seconds % 60;
	return `${ m }m ${ s }s`;
};

/**
 * Returns the IANA timezone string configured in WordPress (e.g.
 * `America/New_York`). Falls back to an `Etc/GMT` offset zone when WP only
 * exposes a numeric UTC offset, and to the browser's own timezone when
 * `@wordpress/date` is unavailable.
 *
 * @return IANA timezone identifier.
 */
function getWpTimezone(): string {
	try {
		const { timezone } = getSettings() as {
			timezone?: { string?: string; offset?: string | number };
		};

		// Validate the IANA timezone string.
		if ( timezone?.string && ! timezone.string.startsWith( 'UTC' ) ) {
			try {
				new Intl.DateTimeFormat( 'en-US', { timeZone: timezone.string });
				return timezone.string;
			} catch {

				// Invalid timezone string, fall through to the next branch.
			}
		}

		// Handle a numeric UTC offset (e.g. UTC+5).
		const offsetHours = parseFloat( String( timezone?.offset ?? '0' ) );

		if ( ! isNaN( offsetHours ) && 0 !== offsetHours ) {

			// The `Etc/GMT` zones invert the sign by convention.
			const sign = 0 < offsetHours ? '-' : '+';
			const tz = `Etc/GMT${ sign }${ Math.abs( offsetHours ) }`;

			try {
				new Intl.DateTimeFormat( 'en-US', { timeZone: tz });
				return tz;
			} catch {

				// Invalid offset conversion, fall through to the next branch.
			}
		}
	} catch {

		// Ignore and fall through to the browser-resolved fallback.
	}

	// Final safe fallback: the browser's own resolved timezone.
	try {
		const fallback = Intl.DateTimeFormat().resolvedOptions().timeZone;

		// Filter invalid timezone identifiers reported by some runtimes.
		if ( fallback && 'Etc/Unknown' !== fallback ) {
			new Intl.DateTimeFormat( 'en-US', { timeZone: fallback });
			return fallback;
		}
	} catch {

		// Ignore and fall through to the absolute fallback.
	}

	return 'UTC';
}

/** Maps date-fns localize widths to their `Intl.DateTimeFormat` equivalents. */
const INTL_MONTH_WIDTHS: Record<string, 'narrow' | 'short' | 'long'> = {
	narrow: 'narrow',
	abbreviated: 'short',
	wide: 'long'
};

const INTL_DAY_WIDTHS: Record<string, 'narrow' | 'short' | 'long'> = {
	narrow: 'narrow',
	short: 'short',
	abbreviated: 'short',
	wide: 'long'
};

let datePickerLocale: Locale | undefined;

/**
 * Returns a date-fns `Locale` for the current WordPress locale, with month and
 * weekday names generated by `Intl.DateTimeFormat`. `react-date-range` only
 * accepts date-fns locale objects; basing the result on `enUS` (already
 * bundled by the library) keeps the non-display fields (`match`, `formatLong`,
 * ordinals) intact without shipping every date-fns locale.
 *
 * @return Locale object for the `locale` prop of `react-date-range`.
 */
const getDatePickerLocale = (): Locale => {
	if ( datePickerLocale ) {
		return datePickerLocale;
	}

	const locale = getLocale();

	const monthName = (
		monthIndex: number,
		width: 'narrow' | 'short' | 'long',
		formatting: boolean
	): string => {
		const date = new Date( 2021, monthIndex, 15 );

		// Inside full dates (`MMMM` tokens) some languages decline the month
		// name; `formatToParts` on a complete date returns that form.
		if ( formatting ) {
			return (
				new Intl.DateTimeFormat( locale, { day: 'numeric', month: width })
					.formatToParts( date )
					.find( ( part ) => 'month' === part.type )?.value ?? ''
			);
		}

		return new Intl.DateTimeFormat( locale, { month: width }).format( date );
	};

	// August 1st 2021 is a Sunday; date-fns day indexes also start on Sunday.
	const dayName = ( dayIndex: number, width: 'narrow' | 'short' | 'long' ): string =>
		new Intl.DateTimeFormat( locale, { weekday: width }).format(
			new Date( 2021, 7, 1 + dayIndex )
		);

	// Follow the WordPress "Week Starts On" setting, like other WP calendars.
	const { l10n } = getSettings() as { l10n?: { startOfWeek?: number } };
	const wpStartOfWeek = Number( l10n?.startOfWeek );

	const built: Locale = {
		...enUS,
		code: locale ?? enUS.code,
		localize: {
			...( enUS.localize as NonNullable<Locale['localize']> ),
			month: ( monthIndex: number, options?: { width?: string; context?: string }) =>
				monthName(
					monthIndex,
					INTL_MONTH_WIDTHS[options?.width ?? 'wide'] ?? 'long',
					'formatting' === options?.context
				),
			day: ( dayIndex: number, options?: { width?: string }) =>
				dayName( dayIndex, INTL_DAY_WIDTHS[options?.width ?? 'wide'] ?? 'long' )
		},
		options: {
			...enUS.options,
			weekStartsOn: ( isNaN( wpStartOfWeek ) ?
				enUS.options?.weekStartsOn ?? 0 :
				wpStartOfWeek ) as 0 | 1 | 2 | 3 | 4 | 5 | 6
		}
	};

	datePickerLocale = built;
	return built;
};

/**
 * Formats a Unix timestamp as a short label for chart x-axis ticks.
 * Uses the WordPress site timezone so labels match server-side grouping.
 *
 * @param timestamp          - Unix timestamp in seconds (UTC).
 * @param interval           - Grouping interval.
 * @param spansMultipleYears - Whether the chart range covers more than one year.
 * @return Short formatted label (e.g. `2 PM`, `Mon 3`, `3 Jan`, `Jan 24`).
 */
function formatAxisLabel(
	timestamp: number,
	interval: ChartInterval | string,
	spansMultipleYears: boolean = false
): string {
	const date = new Date( timestamp * 1000 );
	const timeZone = getWpTimezone();

	switch ( interval ) {
		case 'hour':
			return new Intl.DateTimeFormat( getLocale(), { timeZone, hour: 'numeric' }).format( date );

		case 'day':
			return new Intl.DateTimeFormat( getLocale(), {
				timeZone,
				weekday: 'short',
				day: 'numeric'
			}).format( date );

		case 'week':

			// Show the week-start date; a compact day + short month is most readable.
			return new Intl.DateTimeFormat( getLocale(), {
				timeZone,
				day: 'numeric',
				month: 'short'
			}).format( date );

		case 'month':
			return new Intl.DateTimeFormat( getLocale(), {
				timeZone,
				month: 'short',
				...( spansMultipleYears ? { year: '2-digit' as const } : {})
			}).format( date );

		case 'year':
			return new Intl.DateTimeFormat( getLocale(), {
				timeZone,
				year: 'numeric'
			}).format( date );

		default:
			return new Intl.DateTimeFormat( getLocale(), { timeZone, dateStyle: 'short' }).format( date );
	}
}

/**
 * Formats a Unix timestamp as a detailed label for chart tooltips.
 * Uses the WordPress site timezone so labels match server-side grouping.
 *
 * @param timestamp - Unix timestamp in seconds (UTC).
 * @param interval  - Grouping interval.
 * @return Detailed formatted label (e.g. `Mon 3 Jan 2024, 2:00 PM`, `3 Jan – 9 Jan 2024`).
 */
function formatTooltipLabel(
	timestamp: number,
	interval: ChartInterval | string
): string {
	const date = new Date( timestamp * 1000 );
	const timeZone = getWpTimezone();

	switch ( interval ) {
		case 'hour':
			return new Intl.DateTimeFormat( getLocale(), {
				timeZone,
				weekday: 'short',
				day: 'numeric',
				month: 'short',
				year: 'numeric',
				hour: 'numeric',
				minute: '2-digit'
			}).format( date );

		case 'day':
			return new Intl.DateTimeFormat( getLocale(), {
				timeZone,
				weekday: 'long',
				day: 'numeric',
				month: 'long',
				year: 'numeric'
			}).format( date );

		case 'week': {

			// Show the full week range: start date – end date (week start + 6 days).
			const weekEnd = new Date( ( timestamp + 6 * 24 * 60 * 60 ) * 1000 );
			const fmt = new Intl.DateTimeFormat( getLocale(), {
				timeZone,
				day: 'numeric',
				month: 'short',
				year: 'numeric'
			});
			return `${ fmt.format( date ) } \u2013 ${ fmt.format( weekEnd ) }`;
		}

		case 'month':
			return new Intl.DateTimeFormat( getLocale(), {
				timeZone,
				month: 'long',
				year: 'numeric'
			}).format( date );

		case 'year':
			return new Intl.DateTimeFormat( getLocale(), {
				timeZone,
				year: 'numeric'
			}).format( date );

		default:
			return new Intl.DateTimeFormat( getLocale(), { timeZone, dateStyle: 'long' }).format( date );
	}
}

/**
 * Truncates a string in the middle, preserving the start and end.
 *
 * Useful for long URLs where both the domain and the trailing path segment
 * need to remain visible. The ellipsis character (…) is inserted at the
 * midpoint when the string exceeds `maxLength`.
 *
 * @param {string} str       - The string to truncate.
 * @param {number} maxLength - Maximum character length before truncating.
 * @return {string} The original string, or a middle-truncated version ending with the last `tailLength` characters.
 */
function truncateMiddle( str: string, maxLength: number = 30 ): string {
	if ( str.length <= maxLength ) {
		return str;
	}

	const tailLength = Math.floor( maxLength / 3 );
	const headLength = maxLength - tailLength - 1;

	return str.slice( 0, headLength ) + '…' + str.slice( str.length - tailLength );
}

export {
	getRelativeTime,
	getPercentage,
	getChangePercentage,
	getAbsoluteChangePercentage,
	getBouncePercentage,
	formatUnixToDate,
	isValidDate,
	formatTime,
	formatNumber,
	formatPercentage,
	getCountryName,
	getContinentName,
	getDateWithOffset,
	availableRanges,
	getAvailableRanges,
	getAvailableRangesWithKeys,
	getDisplayDates,
	createValueFormatter,
	formatCurrency,
	toUnixTimestampMillis,
	formatUnixToDateTime,
	formatCurrencyCompact,
	formatDateShort,
	formatDate,
	formatDateAndTime,
	formatUnixToTime,
	formatDuration,
	getWpTimezone,
	getDatePickerLocale,
	formatAxisLabel,
	formatTooltipLabel,
	getChartXAxisTickValues,
	truncateMiddle
};
