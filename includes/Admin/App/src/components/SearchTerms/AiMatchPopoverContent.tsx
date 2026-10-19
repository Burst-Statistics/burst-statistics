import { __ } from '@wordpress/i18n';
import Icon from '@/utils/Icon';
import { useSearchTermSuggestions } from './useSearchTermSuggestions';
import AiMatchHistoryHeader from './AiMatchHistoryHeader';
import AiMatchHistoryTable from './AiMatchHistoryTable';

type AiMatchPopoverContentProps = {

	/** The search term the popover describes. */
	term: string;
};

/**
 * Popover body with the SmartMatch suggestion history of one search term.
 * Mounted only while the popover is open, so the data loads on first open.
 *
 * @param {AiMatchPopoverContentProps} props Component props.
 * @return {JSX.Element} The popover body.
 */
const AiMatchPopoverContent = ({ term }: AiMatchPopoverContentProps ) => {
	const { data, isLoading, error } = useSearchTermSuggestions( term );

	if ( error || isLoading ) {
		return (
			<p className={error ? 'p-5 text-sm text-red' : 'p-5 text-sm text-text-gray'}>
				{error ?
					__( 'Could not load the AI matches for this term.', 'burst-statistics' ) :
					__( 'Loading…', 'burst-statistics' )}
			</p>
		);
	}

	return (
		<div className="text-text-black">
			<AiMatchHistoryHeader
				term={term}
				pageCount={data.rows.length}
				shown={data.shown}
				searches={data.searches}
			/>
			<AiMatchHistoryTable data={data} />
			<p className="mt-2 flex items-start gap-2 border-t border-gray-200 px-5 py-3 text-xs text-text-gray">
				<Icon name="help" size={12} color="gray" className="mt-0.5 shrink-0" />
				{__( 'Clicked = the next pageview in the same session was the suggested page.', 'burst-statistics' )}
			</p>
		</div>
	);
};

export default AiMatchPopoverContent;
