import React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { __ } from '@wordpress/i18n';

interface HelpTooltipProps {

	/** Content to display in the tooltip */
	content: string | React.ReactNode;

	/** Optional side positioning (default: top) */
	side?: 'top' | 'right' | 'bottom' | 'left';

	/** Optional additional className for the trigger */
	className?: string;

	/** Whether tooltip should have an arrow (default: true) */
	hasArrow?: boolean;

	/** Delay in ms before showing tooltip (default: 300) */
	delayDuration?: number;

	/** Children to display in the trigger */
	children?: React.ReactNode;

	/** Render trigger as child to preserve wrapped element layout */
	asChild?: boolean;

	/**
	 * Visual style. 'default' is the compact gray bubble; 'rich' is a cleaner
	 * white card with more breathing room, used for metric explainers.
	 */
	variant?: 'default' | 'rich';
}

const HelpTooltip: React.FC<HelpTooltipProps> = ({
	content,
	side = 'top',
	hasArrow = true,
	delayDuration = 300,
	children,
	asChild = false,
	variant = 'default'
}) => {
	const handleClick = ( e: React.MouseEvent ) => {
		e.preventDefault();
		e.stopPropagation();
	};

	const isRich = 'rich' === variant;

	const contentClassName = isRich ?
		`burst-tooltip z-99999 max-w-[300px] font-normal tracking-normal border px-4 py-3 rounded-lg
            animate-in fade-in-50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0
            data-[state=delayed-open]:data-[side=top]:slide-in-from-bottom-2
            data-[state=delayed-open]:data-[side=bottom]:slide-in-from-top-2
            data-[state=delayed-open]:data-[side=left]:slide-in-from-right-2
            data-[state=delayed-open]:data-[side=right]:slide-in-from-left-2` :
		`burst-tooltip z-99999 max-w-xs font-normal tracking-normal border px-2 py-1.5 text-base rounded
            animate-in fade-in-50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0
            data-[state=delayed-open]:data-[side=top]:slide-in-from-bottom-2
            data-[state=delayed-open]:data-[side=bottom]:slide-in-from-top-2
            data-[state=delayed-open]:data-[side=left]:slide-in-from-right-2
            data-[state=delayed-open]:data-[side=right]:slide-in-from-left-2`;

	return (
		<Tooltip.Provider delayDuration={delayDuration}>
			<Tooltip.Root>
				<Tooltip.Trigger
					asChild={asChild}
					aria-label={__( 'Help information', 'burst-statistics' )}
					onClick={handleClick}
					onMouseDown={( e ) => e.stopPropagation()}
				>
					{children}
				</Tooltip.Trigger>

				<Tooltip.Content
					side={side}
					sideOffset={6}
					className={contentClassName}
					onClick={( e ) => e.stopPropagation()}
				>
					{
						'string' === typeof content ? __( content, 'burst-statistics' ) : content
					}

					{
						hasArrow && (
							<Tooltip.Arrow
								className="burst-tooltip-arrow"
								width={10}
								height={5}
							/>
						)
					}
				</Tooltip.Content>
			</Tooltip.Root>
		</Tooltip.Provider>
	);
};

export default HelpTooltip;
