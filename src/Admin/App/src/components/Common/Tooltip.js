import React from 'react';
import * as TooltipUI from '@radix-ui/react-tooltip';

const Tooltip = ({
  children,
  content,
  delayDuration = 400
}) => {
  if ( ! content ) {
    return <>{children}</>;
  }
  return (
      <TooltipUI.Provider>
        <TooltipUI.Root delayDuration={delayDuration} >
          <TooltipUI.Trigger asChild>
            {children}
          </TooltipUI.Trigger>
            <TooltipUI.Content className="rounded-xs
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
            z-53" sideOffset={5}>
              {content}
              <TooltipUI.Arrow className="fill-black" />
            </TooltipUI.Content>
        </TooltipUI.Root>
      </TooltipUI.Provider>
  );
};

export default Tooltip;
