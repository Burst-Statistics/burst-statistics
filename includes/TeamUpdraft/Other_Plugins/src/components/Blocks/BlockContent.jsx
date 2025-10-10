import React, { memo } from 'react';
import clsx from 'clsx';

export const BlockContent = memo(({ children, className = '' }) => {
  // Check if a custom padding class (e.g., p-2, p-4) is provided in className
  const hasCustomPadding = /\bp-\S+/.test( className );

  return (
    <div className={clsx( 'flex-grow', { 'p-6': ! hasCustomPadding }, className )}>
      {children}
    </div>
  );
});

BlockContent.displayName = 'BlockContent';
