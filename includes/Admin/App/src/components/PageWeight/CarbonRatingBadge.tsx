import { __ } from '@wordpress/i18n';
import HelpTooltip from '@/components/Common/HelpTooltip';

/**
 * Badge colours follow what the grades actually mean, rather than shading
 * every step of the scale: A+ and A are the top tenth of pages measured,
 * F is the only grade that sits above the global average, and everything
 * between is below average without being exceptional.
 *
 * @param {string} rating - The Digital Carbon Rating grade.
 * @return {string} The classes for that grade's tier.
 */
const getRatingClasses = ( rating: string ): string => {
	if ( 'A+' === rating || 'A' === rating ) {
		return 'bg-green-100 text-green';
	}

	if ( 'F' === rating ) {
		return 'bg-red-100 text-red';
	}

	return 'bg-yellow-100 text-text-black';
};

type CarbonRatingBadgeProps = {

	/** The Digital Carbon Rating grade, A+ through F. */
	rating: string;
};

/**
 * The Digital Carbon Rating, on its own line rather than folded into the
 * emissions sentence: it is a separate judgement about the same number, and
 * a bare letter beside a figure reads as part of it.
 *
 * @param {CarbonRatingBadgeProps} props - Component props.
 * @return {JSX.Element} The rating badge and its label.
 */
const CarbonRatingBadge = ({ rating }: CarbonRatingBadgeProps ) => (
	<HelpTooltip
		content={__( 'Digital Carbon Rating: A+ to F, set by this site\'s emissions per pageview under the Sustainable Web Design Model v4. Anything below F emits less than the average web page.', 'burst-statistics' )}
		side="top"
	>
		<span className="mb-2 inline-flex cursor-help items-center gap-1.5">
			<span
				className={`flex h-5 min-w-5 items-center justify-center rounded px-1 text-xs font-semibold ${ getRatingClasses( rating ) }`}
			>
				{ rating }
			</span>
			<span className="text-xs text-text-gray">
				{ __( 'Carbon rating', 'burst-statistics' ) }
			</span>
		</span>
	</HelpTooltip>
);

export default CarbonRatingBadge;
