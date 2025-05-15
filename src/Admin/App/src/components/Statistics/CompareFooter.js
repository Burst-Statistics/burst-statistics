import {__} from '@wordpress/i18n';
import {differenceInDays, parseISO} from 'date-fns';

const CompareFooter = ({noCompare, startDate, endDate}) => {
  let text = '';
  if ( noCompare ) {
    text = __( 'No data available for comparison', 'burst-statistics' );
  } else {
    const startDateISO = parseISO( startDate );
    const endDateISO = parseISO( endDate );

    // get amount of days between start and end date with date-fns
    const days = differenceInDays( endDateISO, startDateISO ) + 1;
    const textStr = ( 1 === days ) ? __( 'vs. previous day', 'burst-statistics' ) : __(
        'vs. previous %s days', 'burst-statistics' );

    // replace %s with days
    text = textStr.replace( '%s', days );
  }


  return (
      <>
        <p className={'burst-small-text'}>{text}</p>
      </>
  );
};

export default CompareFooter;
