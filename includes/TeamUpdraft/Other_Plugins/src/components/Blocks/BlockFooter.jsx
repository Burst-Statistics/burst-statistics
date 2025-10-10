import React, { memo } from 'react';
import clsx from 'clsx';

export const BlockFooter = memo(({ children, className = '' }) => {

  return (
    <div
      className={clsx( className, 'flex items-center justify-between px-6 py-3' )}
    >
      {children}
    </div>
  );
});

BlockFooter.displayName = 'BlockFooter';
