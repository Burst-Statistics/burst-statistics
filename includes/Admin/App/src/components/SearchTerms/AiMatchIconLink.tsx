import Icon from '@/utils/Icon';

type AiMatchIconLinkProps = {
	title: string;
	url: string;
};

/**
 * Link icon to the suggested page, for the narrow Website searches block. The
 * page title is the accessible name; the popover shows it visibly.
 *
 * @param {AiMatchIconLinkProps} props Component props.
 * @return {JSX.Element} The icon link.
 */
const AiMatchIconLink = ({ title, url }: AiMatchIconLinkProps ) => (
	<a
		href={url}
		target="_blank"
		rel="noopener noreferrer"
		aria-label={title}
		className="inline-flex rounded p-0.5 text-blue hover:text-blue-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
	>
		<Icon name="link" size={14} color="blue" />
	</a>
);

export default AiMatchIconLink;
