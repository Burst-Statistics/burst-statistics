import { __ } from '@wordpress/i18n';

import { getDisplayDates } from '@/utils/formatting';

/**
 * CompareFooter displays a short label describing which period the current
 * metrics are being compared against.
 *
 * @param {Object}  props              - Component props.
 * @param {boolean} props.noCompare    - When true, shows a "no data" notice.
 * @param {string}  props.compareStart - Comparison window start (YYYY-MM-DD).
 * @param {string}  props.compareEnd   - Comparison window end (YYYY-MM-DD).
 * @return {JSX.Element} Footer text element.
 */
const CompareFooter = ({ noCompare, compareStart, compareEnd }) => {
	let text = '';

	if ( noCompare ) {
		text = __( 'No data available for comparison', 'burst-statistics' );
	} else {
		const { startDate, endDate } = getDisplayDates( compareStart, compareEnd );
		text = __( 'vs. %s – %s', 'burst-statistics' )
			.replace( '%s', startDate )
			.replace( '%s', endDate );
	}

	return (
		<p className="text-sm font-medium leading-[1.5] text-text-gray">
			{ text }
		</p>
	);
};

export default CompareFooter;
