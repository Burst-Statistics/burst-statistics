import { __ } from '@wordpress/i18n';
import { ChartTooltip } from '@/components/Common/ChartTooltip';

/**
 * Custom tooltip for the retention heatmap.
 *
 * @param {Object} props       - Tooltip props supplied by Nivo.
 * @param {Object} props.cell  - The hovered cell data.
 * @return {JSX.Element} The tooltip element.
 */
export function RetentionTooltip({ cell }) {
	const { serieId, data } = cell;
		const period = String( data.x ?? '' );
	const value = data.y;

	if ( null === value ) {
		return null;
	}

		const matches = period.match( /^([MQY])\+(\d+)$/ );

		if ( ! matches ) {
			return null;
		}

		const periodUnit = matches[1];
		const periodIndex = parseInt( matches[2], 10 );
		const periodLabel = 'Q' === periodUnit ?
			1 === periodIndex ?
				__( '1 quarter later', 'burst-statistics' ) :
				`${ periodIndex } ${ __( 'quarters later', 'burst-statistics' ) }` :
			'Y' === periodUnit ?
				1 === periodIndex ?
					__( '1 year later', 'burst-statistics' ) :
					`${ periodIndex } ${ __( 'years later', 'burst-statistics' ) }` :
				1 === periodIndex ?
					__( '1 month later', 'burst-statistics' ) :
					`${ periodIndex } ${ __( 'months later', 'burst-statistics' ) }`;

	return (
		<ChartTooltip className="min-w-44">
			<p className="font-semibold text-gray-700 mb-1">{ serieId }</p>
			<div className="flex justify-between gap-4 text-gray-500">
				<span>{ periodLabel }</span>
				<span className="font-semibold text-gray-800">{ value }%</span>
			</div>
		</ChartTooltip>
	);
}
