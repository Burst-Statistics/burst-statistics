import { __, sprintf } from '@wordpress/i18n';
import HelpTooltip from '@/components/Common/HelpTooltip';
import { formatNumber } from '@/utils/formatting';

type SearchVolumeProps = {

	/** Number of times the term was searched. */
	volume: number;

	/** How many of those searches showed a SmartMatch suggestion. */
	aiShown: number;
};

/**
 * Search volume, followed by the number of those searches that showed an AI
 * match in brackets, e.g. "6 (4)", explained in a tooltip.
 *
 * @param {SearchVolumeProps} props Component props.
 * @return {JSX.Element} The volume.
 */
const SearchVolume = ({ volume, aiShown }: SearchVolumeProps ) => {
	const total = formatNumber( volume, 0, false );
	if ( 0 >= aiShown ) {
		return <>{total}</>;
	}

	return (
		<HelpTooltip
			content={sprintf(

				/* translators: 1: searches that showed an AI match, 2: total searches. */
				__( '%1$s of %2$s searches showed an AI match', 'burst-statistics' ),
				formatNumber( aiShown, 0, false ),
				total
			)}
		>
			<span className="tabular-nums">
				{total} <span className="text-text-gray">({formatNumber( aiShown, 0, false )})</span>
			</span>
		</HelpTooltip>
	);
};

export default SearchVolume;
