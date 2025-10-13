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
                className="burst rounded-xs
                px-xs py-[7px]
                text-base leading-[1.5]
                text-white
                bg-black
                shadow-tooltip
                select-none
                will-change-transform will-change-opacity
                max-w-[40ch]
                animate-[none]
                data-[state=delayed-open]:data-[side=top]:animate-slideDownAndFade
                data-[state=delayed-open]:data-[side=right]:animate-slideLeftAndFade
                data-[state=delayed-open]:data-[side=bottom]:animate-slideUpAndFade
                data-[state=delayed-open]:data-[side=left]:animate-slideRightAndFade
                z-53"
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
