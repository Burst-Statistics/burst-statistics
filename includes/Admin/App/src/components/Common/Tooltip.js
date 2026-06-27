import React from 'react';
import * as TooltipUI from '@radix-ui/react-tooltip';

const Tooltip = ({ children, content, delayDuration = 400 }) => {

	if ( ! content ) {
		return children;
	}

	return (
		<TooltipUI.Provider>
			<TooltipUI.Root delayDuration={delayDuration}>
				<TooltipUI.Trigger asChild>{children}</TooltipUI.Trigger>

				<TooltipUI.Content
					className="burst-tooltip z-99999 max-w-xs border px-3 py-2 text-base rounded
					animate-in fade-in-50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0
					data-[state=delayed-open]:data-[side=top]:slide-in-from-bottom-2
					data-[state=delayed-open]:data-[side=bottom]:slide-in-from-top-2
					data-[state=delayed-open]:data-[side=left]:slide-in-from-right-2
					data-[state=delayed-open]:data-[side=right]:slide-in-from-left-2"
					sideOffset={5}
				>
					{ content }

					<TooltipUI.Arrow
						className="burst-tooltip-arrow"
						width={10}
						height={5}
					/>
				</TooltipUI.Content>
			</TooltipUI.Root>
		</TooltipUI.Provider>
	);
};

export default Tooltip;
