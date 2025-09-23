import React, { memo } from 'react';
import clsx from 'clsx';

export const BlockHeading = memo(({ title, controls, className = '' }) => {
  return (
    <div
      className={clsx(
        className,
        'flex min-h-16 items-center justify-between px-6 gap-4 max-m:px-2.5'
      )}
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      {controls}
    </div>
  );
});

BlockHeading.displayName = 'BlockHeading';
