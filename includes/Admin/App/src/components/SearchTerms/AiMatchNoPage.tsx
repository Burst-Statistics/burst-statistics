import { __ } from '@wordpress/i18n';

type AiMatchNoPageProps = {

	/** Show a dash instead of the text, for the narrow Website searches block. */
	iconOnly: boolean;
};

/**
 * AI match cell content when the AI found nothing relevant. Focusable, so
 * keyboard users can open the popover.
 *
 * @param {AiMatchNoPageProps} props Component props.
 * @return {JSX.Element} The label.
 */
const AiMatchNoPage = ({ iconOnly }: AiMatchNoPageProps ) => (
	<span
		tabIndex={0}
		aria-label={__( 'No relevant page', 'burst-statistics' )}
		className="truncate text-text-gray focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
	>
		{iconOnly ? '–' : __( 'No relevant page', 'burst-statistics' )}
	</span>
);

export default AiMatchNoPage;
