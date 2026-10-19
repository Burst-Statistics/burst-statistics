import AiMatchIconLink from './AiMatchIconLink';
import AiMatchNoPage from './AiMatchNoPage';
import AiMatchPageLink from './AiMatchPageLink';

type AiMatchLabelProps = {
	title: string;
	url: string;

	/** Searches that showed a suggestion for the term. */
	shown: number;

	/** Number of other pages that were suggested for the term. */
	alternatives: number;

	/** Show only the link icon; the popover carries the page title. */
	iconOnly: boolean;
};

/**
 * Visible content of an AI match cell: the most-shown page as a link (only its
 * icon in the compact block), or "No relevant page" when nothing was shown.
 *
 * @param {AiMatchLabelProps} props Component props.
 * @return {JSX.Element} The label.
 */
const AiMatchLabel = ({ title, url, shown, alternatives, iconOnly }: AiMatchLabelProps ) => {
	if ( 0 === shown || '' === title ) {
		return <AiMatchNoPage iconOnly={iconOnly} />;
	}

	if ( iconOnly ) {
		return <AiMatchIconLink title={title} url={url} />;
	}

	return <AiMatchPageLink title={title} url={url} alternatives={alternatives} />;
};

export default AiMatchLabel;
