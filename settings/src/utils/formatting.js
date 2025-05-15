import { dateI18n } from '@wordpress/date';
import { format, isSameDay, startOfDay, endOfDay, addDays, addMonths, startOfMonth, endOfMonth, startOfYear, endOfYear, addYears } from 'date-fns';
import {__} from '@wordpress/i18n';

/**
 * Returns a formatted string that represents the relative time between two dates
 * @param {Date | number} relativeDate - The date to compare or a UTC timestamp
 * @param {Date} date - The reference date, defaults to the current date
 * @returns {string} The relative time string
 */
const getRelativeTime = ( relativeDate, date = new Date() ) => {

  // if relativeDate is a number, we assume it is an UTC timestamp
  if ( 'number' === typeof relativeDate ) {

    // convert to date object
    relativeDate = new Date( relativeDate * 1000 );
  }
  if ( ! ( relativeDate instanceof Date ) ) {

    // invalid date, probably still loading
    return '-';
  }
  let units = {
    year: 24 * 60 * 60 * 1000 * 365,
    month: 24 * 60 * 60 * 1000 * 365 / 12,
    day: 24 * 60 * 60 * 1000,
    hour: 60 * 60 * 1000,
    minute: 60 * 1000,
    second: 1000
  };
  let rtf = new Intl.RelativeTimeFormat( 'en', { numeric: 'auto' });
  let elapsed = relativeDate - date;

  // "Math.abs" accounts for both "past" & "future" scenarios
  for ( let u in units ) {
    if ( Math.abs( elapsed ) > units[u] || 'second' === u ) {
      return rtf.format( Math.round( elapsed / units[u]), u );
    }
  }
};

/**
 * Calculates the percentage of a value from the total and returns it as a formatted string or a number
 * @param {number} val - The value to calculate the percentage of
 * @param {number} total - The total value
 * @param {boolean} format - If true, returns the percentage as a formatted string, otherwise as a number
 * @returns {string | number} The formatted percentage or the raw percentage
 */
const getPercentage = ( val, total, format = true ) => {
  val = Number( val );
  total = Number( total );
  let percentage = val / total;
  if ( isNaN( percentage ) ) {
    percentage = 0;
  }
  return format ? new Intl.NumberFormat(
      undefined,
      {
        style: 'percent',
        maximumFractionDigits: 1
      }).format( percentage ) : percentage;
};

/**
 * Calculates the percentage change between two values and returns an object with the formatted percentage and status
 * @param {number} currValue - The current value
 * @param {number} prevValue - The previous value
 * @returns {Object} An object with a formatted percentage and a status ('positive' or 'negative')
 */
function getChangePercentage( currValue, prevValue ) {
  currValue = Number( currValue );
  prevValue = Number( prevValue );

  let change = {};
  let percentage = ( currValue - prevValue ) / prevValue;
  if ( isNaN( percentage ) ) {
    percentage = 0;
  }

  change.val =  new Intl.NumberFormat(
      undefined,
      {
        style: 'percent',
        maximumFractionDigits: 1,
        signDisplay: 'exceptZero'
      }).format( percentage );
  change.status = ( 0 < percentage ) ? 'positive' : 'negative';

  if ( percentage === Infinity ) {
    change.val = '';
    change.status = 'positive';
  }

  return change;
}

/**
 * Calculates the bounce percentage of bounced sessions and total sessions
 * @param {number} bounced_sessions - The number of bounced sessions
 * @param {number} sessions - The total number of sessions
 * @param {boolean} format - If true, returns the bounce percentage as a formatted string, otherwise as a number
 * @returns {string | number} The formatted bounce percentage or the raw bounce percentage
 */
function getBouncePercentage( bounced_sessions, sessions, format = true ) {
  bounced_sessions = Number( bounced_sessions );
  sessions = Number( sessions );
  return getPercentage( bounced_sessions, sessions + bounced_sessions, format );
}

/**
 * Formats a Unix timestamp as a date string, using the site's locale and wp date format
 * @param {number} unixTimestamp - The Unix timestamp to format
 * @returns {string} The formatted date string
 */
const formatUnixToDate = ( unixTimestamp ) => {
  const formattedDate = dateI18n( burst_settings.date_format, new Date( unixTimestamp * 1000 ) );
  return formattedDate;
};

/**
 * Check if a date is valid
 * @param {string | number} date - The date to check
 * @return {boolean}
 */
const  isValidDate = ( date ) => {
  const MIN_START_DATE = 1640995200 * 1000; // January 1, 2022 in Unix timestamp
  return date && ( 'number' === typeof date || Date.parse( date ) >= MIN_START_DATE );
};

/**
 * Converts a date to a Unix timestamp in milliseconds
 * @param {string | number} date - The date to convert
 * @return {number|number|number}
 */
const toUnixTimestampMillis = ( date ) => {
  if ( 'number' === typeof date ) {

    // If the number is 10 digits long, assume it's in seconds and convert to milliseconds
    return 10 === date.toString().length ? date * 1000 : date;
  }

  // If it's a string, parse it to get milliseconds
  return Date.parse( date );
};

/**
 * Formats a duration given in milliseconds as a time string in the format 'HH:mm:ss'
 * @param {number} timeInMilliSeconds - The duration in milliseconds
 * @returns {string} The formatted time string
 */
function formatTime( timeInMilliSeconds = 0 ) {
  let timeInSeconds = Number( timeInMilliSeconds );
  if ( isNaN( timeInSeconds ) ) {
    timeInSeconds = 0;
  }

  const seconds = Math.floor( timeInSeconds / 1000 );
  const hours = Math.floor( seconds / 3600 );
  const minutes = Math.floor( ( seconds - ( hours * 3600 ) ) / 60 );
  const remainingSeconds = seconds - ( hours * 3600 ) - ( minutes * 60 );

  const zeroPad = ( num ) => {
    if ( isNaN( num ) ) {
      return '00';
    }
    return String( num ).padStart( 2, '0' );
  };

  const formatted = [
    hours,
    minutes,
    remainingSeconds
  ].map( zeroPad );

  return formatted.join( ':' );
}

/**
 * Formats a number using compact notation with the specified number of decimal places
 * @param {number} value - The number to format
 * @param {number} decimals - The number of decimal places to use
 * @returns {string} The formatted number
 */
function formatNumber( value, decimals = 1 ) {
  value = Number( value );
  if ( isNaN( value ) ) {
    value = 0;
  }
  return new Intl.NumberFormat( undefined, {
    style: 'decimal',
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: decimals
  }).format( value );
}

/**
 * Formats a percentage value with the specified number of decimal places
 * @param {number} value - The percentage value (not multiplied by 100)
 * @param {number} decimals - The number of decimal places to use
 * @returns {string} The formatted percentage
 */
function formatPercentage( value, decimals = 1 ) {
  value = Number( value ) / 100;

  if ( isNaN( value ) ) {
    value = 0;
  }
  return new Intl.NumberFormat( undefined, {
    style: 'percent',
    maximumFractionDigits: decimals
  }).format( value );
}

/**
 * Returns the name of a country based on its country code. If undefined return Unknown
 * @param countryCode
 * @return {*}
 */
function getCountryName( countryCode ) {
  if ( countryCode ) {
    return burst_settings.countries[countryCode.toUpperCase()] || __( 'Unknown', 'burst-statistics' );
  }
  return __( 'Unknown', 'burst-statistics' );
}

function getDateWithOffset( currentDate = new Date() ) {

  // get client's timezone offset in minutes
  const clientTimezoneOffsetMinutes = currentDate.getTimezoneOffset();

  // convert client's timezone offset from minutes to seconds
  const clientTimezoneOffsetSeconds = clientTimezoneOffsetMinutes * -60;

  // get current unix timestamp
  const currentUnix = Math.floor( currentDate.getTime() / 1000 );

  // add burst_settings.gmt_offset x hour and client's timezone offset in
  // seconds to currentUnix
  const currentUnixWithOffsets = currentUnix +
      ( burst_settings.gmt_offset * 3600 ) - clientTimezoneOffsetSeconds;

  const currentDateWithOffset = new Date( currentUnixWithOffsets * 1000 );

  return currentDateWithOffset;
}
const currentDateWithOffset = getDateWithOffset();

const availableRanges = {
  'today': {
    label: __( 'Today', 'burst-statistics' ),
    range: () => ({
      startDate: startOfDay( currentDateWithOffset ),
      endDate: endOfDay( currentDateWithOffset )
    })
  },
  'yesterday': {
    label: __( 'Yesterday', 'burst-statistics' ),
    range: () => ({
      startDate: startOfDay( addDays( currentDateWithOffset, -1 ) ),
      endDate: endOfDay( addDays( currentDateWithOffset, -1 ) )
    })
  },
  'last-7-days': {
    label: __( 'Last 7 days', 'burst-statistics' ),
    range: () => ({
      startDate: startOfDay( addDays( currentDateWithOffset, -7 ) ),
      endDate: endOfDay( addDays( currentDateWithOffset, -1 ) )
    })
  },
  'last-30-days': {
    label: __( 'Last 30 days', 'burst-statistics' ),
    range: () => ({
      startDate: startOfDay( addDays( currentDateWithOffset, -30 ) ),
      endDate: endOfDay( addDays( currentDateWithOffset, -1 ) )
    })
  },
  'last-90-days': {
    label: __( 'Last 90 days', 'burst-statistics' ),
    range: () => ({
      startDate: startOfDay( addDays( currentDateWithOffset, -90 ) ),
      endDate: endOfDay( addDays( currentDateWithOffset, -1 ) )
    })
  },
  'last-month': {
    label: __( 'Last month', 'burst-statistics' ),
    range: () => ({
      startDate: startOfMonth( addMonths( currentDateWithOffset, -1 ) ),
      endDate: endOfMonth( addMonths( currentDateWithOffset, -1 ) )
    })
  },
  'week-to-date': {
    label: __( 'Week to date', 'burst-statistics' ),
    range: () => ({
      startDate: startOfDay( addDays( currentDateWithOffset, -currentDateWithOffset.getDay() ) ),
      endDate: endOfDay( currentDateWithOffset )
    })
  },
  'month-to-date': {
    label: __( 'Month to date', 'burst-statistics' ),
    range: () => ({
      startDate: startOfMonth( currentDateWithOffset ),
      endDate: endOfDay( currentDateWithOffset )
    })
  },
  'year-to-date': {
    label: __( 'Year to date', 'burst-statistics' ),
    range: () => ({
      startDate: startOfYear( currentDateWithOffset ),
      endDate: endOfDay( currentDateWithOffset )
    })
  },
  'last-year': {
    label: __( 'Last year', 'burst-statistics' ),
    range: () => ({
      startDate: startOfYear( addYears( currentDateWithOffset, -1 ) ),
      endDate: endOfYear( addYears( currentDateWithOffset, -1 ) )
    })
  }
};

const getAvailableRanges = ( selectedRanges ) => {
  return Object.values( selectedRanges ).filter( Boolean ).map( ( value ) => {
    const range = availableRanges[value];
    range.isSelected = isSelected;
    return range;
  });
};

const getAvailableRangesWithKeys = ( selectedRanges ) => {
  let ranges = {};
  Object.keys( availableRanges ) // Get the keys from the availableRanges object
      .filter( key => selectedRanges.includes( key ) ) // Filter the keys based on selectedRanges
      .forEach( key => {
        ranges[key] = { // Assign a new object to the key on the ranges object
          ...availableRanges[key] // Spread the properties from the range object
        };
      });
  return ranges;
};

const getDisplayDates = ( startDate, endDate ) => {
  const formatString = 'MMMM d, yyyy';
  return {
    startDate: startDate ? format( new Date( startDate ), formatString ) : format( defaultStart, formatString ),
    endDate: endDate ? format( new Date( endDate ), formatString ) : format( defaultEnd, formatString )
  };
};

function isSelected( range ) {
  const definedRange = this.range();
  return (
      isSameDay( range.startDate, definedRange.startDate ) &&
      isSameDay( range.endDate, definedRange.endDate )
  );
}

export {
  getRelativeTime,
  getPercentage,
  getChangePercentage,
  getBouncePercentage,
  formatUnixToDate,
  isValidDate,
  toUnixTimestampMillis,
  formatTime,
  formatNumber,
  formatPercentage,
  getCountryName,
  getDateWithOffset,
  availableRanges,
  getAvailableRanges,
  getAvailableRangesWithKeys,
  getDisplayDates,
  isSelected
};
