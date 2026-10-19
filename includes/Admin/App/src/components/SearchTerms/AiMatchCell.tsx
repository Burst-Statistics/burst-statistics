import { memo } from 'react';
import * as Popover from '@radix-ui/react-popover';
import getPortalContainer from '@/utils/getPortalContainer';
import { useHoverOpen } from '@/hooks/useHoverOpen';
import AiMatchLabel from './AiMatchLabel';
import AiMatchPopoverContent from './AiMatchPopoverContent';

/**
 * The search-terms row fields the AI match cell reads.
 */
type AiMatchRow = {
	term: string;

	/** Searches that showed a SmartMatch suggestion. */
	ai_shown: number;

	/** Searches where the AI found nothing relevant. */
	ai_none: number;
	ai_title: string;
	ai_url: string;

	/** Number of other pages that were suggested for the term. */
	ai_alternatives: number;
};

type AiMatchCellProps = {
	row: AiMatchRow;

	/** Show only the link icon, for the narrow Website searches block. */
	compact?: boolean;
};

/**
 * Whether SmartMatch computed anything for the term: a shown page or "nothing relevant".
 *
 * @param {AiMatchRow} row The search-term row.
 * @return {boolean} True when there is a history to show.
 */
const hasAiHistory = ( row: AiMatchRow ): boolean => 0 < Number( row.ai_shown ) + Number( row.ai_none );

/**
 * "AI match" cell of the search-terms datatable. Hovering or focusing the cell
 * opens the term's suggestion history, which is loaded on first open.
 *
 * @param {AiMatchCellProps} props Component props.
 * @return {JSX.Element} The cell content.
 */
const AiMatchCell = memo( ({ row, compact = false }: AiMatchCellProps ) => {
	const { isOpen, setIsOpen, open, scheduleClose } = useHoverOpen();
	if ( ! hasAiHistory( row ) ) {
		return <span className="text-text-gray">–</span>;
	}

	return (
		<Popover.Root open={isOpen} onOpenChange={setIsOpen}>
			<Popover.Anchor asChild>
				<span
					className={compact ? 'inline-flex' : 'flex w-full min-w-0 items-center gap-2'}
					onMouseEnter={open}
					onMouseLeave={scheduleClose}
					onFocus={open}
					onBlur={scheduleClose}
				>
					<AiMatchLabel
						title={row.ai_title}
						url={row.ai_url}
						shown={Number( row.ai_shown )}
						alternatives={Number( row.ai_alternatives )}
						iconOnly={compact}
					/>
				</span>
			</Popover.Anchor>
			<Popover.Portal container={getPortalContainer()}>
				<Popover.Content
					align="end"
					side="bottom"
					sideOffset={8}
					collisionPadding={16}

					// Keep focus on the cell link so keyboard users can still follow it.
					onOpenAutoFocus={( event ) => event.preventDefault()}
					onMouseEnter={open}
					onMouseLeave={scheduleClose}
					className="burst z-modal w-[420px] max-w-[calc(100vw-32px)] rounded-xl border border-gray-200 bg-white shadow-xl"
				>
					<AiMatchPopoverContent term={row.term} />
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	);
});

AiMatchCell.displayName = 'AiMatchCell';

export default AiMatchCell;
