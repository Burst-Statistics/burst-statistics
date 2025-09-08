import React from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { __ } from "@wordpress/i18n";

interface HelpTooltipProps {
  /** Content to display in the tooltip */
  content: string | React.ReactNode;
  /** Optional side positioning (default: top) */
  side?: "top" | "right" | "bottom" | "left";
  /** Optional additional className for the trigger */
  className?: string;
  /** Whether tooltip should have an arrow (default: true) */
  hasArrow?: boolean;
  /** Delay in ms before showing tooltip (default: 300) */
  delayDuration?: number;
  /** Children to display in the trigger */
  children?: React.ReactNode;
}

const HelpTooltip: React.FC<HelpTooltipProps> = ({
  content,
  side = "top",
  className = "",
  hasArrow = true,
  delayDuration = 300,
  children,
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <Tooltip.Provider delayDuration={delayDuration}>
      <Tooltip.Root>
        <Tooltip.Trigger
          aria-label={__("Help information", "burst-statistics")}
          onClick={handleClick}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {children}
        </Tooltip.Trigger>

          <Tooltip.Content
            side={side}
            sideOffset={5}
            className="z-50 max-w-xs bg-gray-200 text-gray border border-gray-400 px-3 py-2 text-base rounded shadow-md
            animate-in fade-in-50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 
            data-[state=delayed-open]:data-[side=top]:slide-in-from-bottom-2
            data-[state=delayed-open]:data-[side=bottom]:slide-in-from-top-2
            data-[state=delayed-open]:data-[side=left]:slide-in-from-right-2
            data-[state=delayed-open]:data-[side=right]:slide-in-from-left-2"
            onClick={(e) => e.stopPropagation()}
          >
            {typeof content === "string" ? __(content, "burst-statistics") : content}
            
            {hasArrow && (
              <Tooltip.Arrow className="fill-gray-300" width={10} height={5} />
            )}
          </Tooltip.Content>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
};

export default HelpTooltip;
