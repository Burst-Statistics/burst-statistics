import { __, sprintf } from '@wordpress/i18n';
import Icon from '@/utils/Icon';

type AiMatchPageLinkProps = {
	title: string;
	url: string;

	/** Number of other pages that were suggested for the term. */
	alternatives: number;
};

/**
 * The most-shown suggested page as a link, with a "+N" pill for the other
 * pages that were suggested for the term.
 *
 * @param {AiMatchPageLinkProps} props Component props.
 * @return {JSX.Element} The link.
 */
const AiMatchPageLink = ({ title, url, alternatives }: AiMatchPageLinkProps ) => (
	<>
		<a
			href={url}
			target="_blank"
			rel="noopener noreferrer"
			className="flex min-w-0 items-center gap-1.5 text-blue hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
		>
			<Icon name="link" size={13} color="blue" className="shrink-0" />
			<span className="truncate">{title}</span>
		</a>
		{0 < alternatives && (
			<span className="shrink-0 rounded-full bg-blue-light px-1.5 text-xs font-semibold text-blue">
				<span aria-hidden="true">+{alternatives}</span>
				<span className="sr-only">
					{sprintf(

						/* translators: %d: number of other suggested pages. */
						__( '%d other pages were suggested for this term', 'burst-statistics' ),
						alternatives
					)}
				</span>
			</span>
		)}
	</>
);

export default AiMatchPageLink;
