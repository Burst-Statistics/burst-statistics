import React, { memo } from 'react';
import clsx from 'clsx';

export const BlockHeading = memo(({ title, controls, className = '' }) => {
  return (
    <div
      className={clsx(
        className,
        'flex min-h-16 items-center justify-between px-l gap-4 max-m:px-s'
      )}
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      {controls}
    </div>
  );
});

BlockHeading.displayName = 'BlockHeading';
