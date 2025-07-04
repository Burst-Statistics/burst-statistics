import React, {useEffect, useState, useRef} from '@wordpress/element';
import * as TooltipUI from '@radix-ui/react-tooltip';
import {useMouse} from '@/hooks/useMouse';

const CursorTooltip = ({
  children,
  content,
  delayDuration = 400
}) => {
  const {ref, x, y} = useMouse();

  if ( ! content ) {
    return <>{children}</>;
  }

  return (
      <TooltipUI.Provider>
        <TooltipUI.Root
            delayDuration={delayDuration}
            disableHoverableContent={true}
        >
          <TooltipUI.Trigger asChild ref={ref}>
            {children}
          </TooltipUI.Trigger>
          <TooltipUI.Portal>
            <TooltipUI.Content
                className="burst burst-tooltip-content burst-map-tooltip"
                align="start"
                alignOffset={x}
                sideOffset={-y + 10}
                hideWhenDetached
            >
              {content}
            </TooltipUI.Content>
          </TooltipUI.Portal>
        </TooltipUI.Root>
      </TooltipUI.Provider>
  );
};

export default CursorTooltip;
