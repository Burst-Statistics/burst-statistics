import { __, _n, sprintf } from '@wordpress/i18n';
import Icon from '@/utils/Icon';
import { formatNumber } from '@/utils/formatting';

type AiMatchHistoryHeaderProps = {
	term: string;

	/** Number of different pages that were shown. */
	pageCount: number;
	shown: number;
	searches: number;
};

/**
 * Conclusion-first heading of the AI match popover.
 *
 * @param {AiMatchHistoryHeaderProps} props Component props.
 * @return {JSX.Element} The heading.
 */
const AiMatchHistoryHeader = ({ term, pageCount, shown, searches }: AiMatchHistoryHeaderProps ) => {
	const title = 0 < pageCount ?
		sprintf(

			/* translators: 1: search term, 2: number of different pages. */
			_n( 'Visitors searching “%1$s” got %2$d page', 'Visitors searching “%1$s” got %2$d different pages', pageCount, 'burst-statistics' ),
			term,
			pageCount
		) :
		sprintf(

			/* translators: %s: search term. */
			__( 'Visitors searching “%s” got no AI match', 'burst-statistics' ),
			term
		);

	return (
		<div className="flex items-start gap-2 border-b border-gray-200 px-5 py-4">
			<Icon name="sparkles" size={16} color="blue" className="mt-0.5 shrink-0" />
			<div className="min-w-0">
				<h4 className="text-sm font-semibold text-text-black">{title}</h4>
				<p className="mt-0.5 text-xs text-text-gray">
					{sprintf(

						/* translators: 1: searches that showed an AI match, 2: total searches. */
						__( '%1$s of %2$s searches showed an AI match', 'burst-statistics' ),
						formatNumber( shown, 0, false ),
						formatNumber( searches, 0, false )
					)}
				</p>
			</div>
		</div>
	);
};

export default AiMatchHistoryHeader;
