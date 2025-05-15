import React, { memo } from 'react';
import clsx from 'clsx';

const BlockFooter = ({ children, className = '' }) => {
  return (
    <div
      className={clsx( className, 'flex items-center justify-between px-6 py-3' )}
    >
      {children}
    </div>
  );
};

BlockFooter.displayName = 'BlockFooter';
export default memo( BlockFooter );
