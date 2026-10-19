import { Fragment, type ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { createInterpolateElement } from '@wordpress/element';
import { formatNumber } from '@/utils/formatting';
import { formatEmissions } from './pageWeightFormat';
import CarbonRatingBadge from './CarbonRatingBadge';
import type { FooterFigures } from './footerSections';

type EstimateSectionProps = {

	/** The figures to report. */
	figures: FooterFigures;

	/** Whether to show the emissions sentence. */
	showEstimate: boolean;

	/** Whether to show the carbon rating badge. */
	showRating: boolean;

	/** Whether the figures are the green hosting preview. */
	isAssumed: boolean;

	/** Share of pageviews the figures are based on, 0 to 1. */
	measuredRatio: number;
};

/**
 * Joins qualifying phrases with middots.
 *
 * Each phrase carries its own separator so the two wrap together: a middot
 * left as its own flex item ends up stranded at a line break.
 *
 * @param {Object}      props       - Component props.
 * @param {ReactNode[]} props.items - The phrases to show.
 * @return {JSX.Element} The qualifier line.
 */
const MetaLine = ({ items }: { items: ReactNode[] }) => (
	<p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-text-gray">
		{ items.map( ( item, index ) => (
			<span key={index} className="flex items-center gap-1.5">
				{ 0 < index && <span aria-hidden="true">·</span> }
				{ item }
			</span>
		) ) }
	</p>
);

/**
 * Builds the phrases qualifying whatever is shown above them.
 *
 * These apply to the rating as much as to the emissions sentence, so they show
 * whenever either half is on screen.
 *
 * @param {number}  measuredRatio - Share of pageviews measured.
 * @param {boolean} isAssumed     - Whether green hosting is assumed.
 * @return {ReactNode[]} The phrases, in reading order.
 */
const buildQualifiers = ( measuredRatio: number, isAssumed: boolean ): ReactNode[] => {
	const items: ReactNode[] = [];

	if ( 1 > measuredRatio ) {
		items.push( sprintf(

			/* translators: %d is the percentage of pageviews on pages Burst has measured. */
			__( 'Based on the %d%% of pageviews on measured pages', 'burst-statistics' ),
			Math.round( measuredRatio * 100 )
		) );
	}

	if ( isAssumed ) {
		items.push(
			<span className="italic">
				{ __( 'Assuming green hosting', 'burst-statistics' ) }
			</span>
		);
	}

	return items;
};

/**
 * The carbon rating and the emissions figure.
 *
 * The two are independent menu toggles, so either can be shown without the
 * other; the qualifiers below them apply to whichever is on screen.
 *
 * @param {EstimateSectionProps} props - Component props.
 * @return {JSX.Element} The estimate section.
 */
const EstimateSection = ({
	figures,
	showEstimate,
	showRating,
	isAssumed,
	measuredRatio
}: EstimateSectionProps ) => {
	const qualifiers = buildQualifiers( measuredRatio, isAssumed );

	return (
		<>
			{ showRating && (
				<div>
					<CarbonRatingBadge rating={figures.carbon_rating} />
				</div>
			) }

			{ showEstimate && (
				<p className="text-text-gray">
					{ createInterpolateElement(
						sprintf(

							/* translators: 1: total emissions with unit, 2: emissions per pageview in grams. */
							__( 'Estimated <strong>%1$s</strong> this period · %2$s g per pageview', 'burst-statistics' ),
							formatEmissions( figures.total_co2_grams ),
							formatNumber( figures.co2_per_pageview_grams, 2, false )
						),
						{ strong: <strong className="font-semibold text-text-black" /> }
					) }
				</p>
			) }

			{ 0 < qualifiers.length && <MetaLine items={qualifiers} /> }
		</>
	);
};

export default EstimateSection;
