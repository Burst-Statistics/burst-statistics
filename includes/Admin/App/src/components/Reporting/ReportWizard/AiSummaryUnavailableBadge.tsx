import { __, sprintf } from '@wordpress/i18n';
import HelpTooltip from '@/components/Common/HelpTooltip';
import Icon from '@/utils/Icon';

interface AiSummaryUnavailableBadgeProps {

	/** Why AI summaries are unavailable, shown in the tooltip. */
	reason: string;
}

/**
 * Compact "Setup required" badge for the AI summary block.
 *
 * The full reason is long, so it lives in a tooltip instead of inside the block card,
 * which keeps the card the same size as the other blocks. The trigger is focusable so
 * keyboard users can reach the reason too.
 *
 * @param props        - Component props.
 * @param props.reason - Why AI summaries are unavailable.
 * @return The badge with its tooltip.
 */
const AiSummaryUnavailableBadge = ({ reason }: AiSummaryUnavailableBadgeProps ) => {
	const label = __( 'Setup required', 'burst-statistics' );

	return (
		<HelpTooltip content={reason} asChild>
			<span
				tabIndex={0}
				aria-label={sprintf(

					/* translators: 1: "Setup required" label, 2: reason why AI summaries are unavailable. */
					__( '%1$s: %2$s', 'burst-statistics' ),
					label,
					reason
				)}
				className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded text-xs text-text-gray cursor-help focus:outline-hidden focus:ring-2 focus:ring-blue"
			>
				<Icon name="warning" size={14} color="yellow" />
				{label}
			</span>
		</HelpTooltip>
	);
};

export default AiSummaryUnavailableBadge;
