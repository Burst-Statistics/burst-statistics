import { __ } from '@wordpress/i18n';
import {differenceInDays, parseISO} from 'date-fns';

interface SalesFooterProps {
    startDate: string;
    endDate: string;
}

/**
 * SalesFooter component.
 *
 * @param {Object} props - Component props.
 * @param {string} props.startDate - The start date of the current period (ISO format).
 * @param {string} props.endDate - The end date of the current period (ISO format).
 * @returns {JSX.Element} The rendered component.
 */
const SalesFooter = ( { startDate, endDate }: SalesFooterProps ) => {
    const startDateISO = parseISO( startDate );
    const endDateISO = parseISO( endDate );

    const days = differenceInDays( endDateISO, startDateISO ) + 1;
    const textStr = ( 1 === days ) ? __( 'vs. previous day', 'burst-statistics' ) : __(
        'vs. previous %s days', 'burst-statistics' );

    const text = textStr.replace( '%s', days + '' );

    return (
        <p className="text-sm font-medium leading-[1.5] text-gray">{text}</p>
    );
};

export default SalesFooter;
