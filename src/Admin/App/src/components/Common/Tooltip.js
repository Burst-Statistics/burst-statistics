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
            <TooltipUI.Content className="burst-tooltip-content z-53" sideOffset={5}>
              {content}
              <TooltipUI.Arrow className="burst-tooltip-arrow" />
            </TooltipUI.Content>
        </TooltipUI.Root>
      </TooltipUI.Provider>
  );
};

export default Tooltip;
