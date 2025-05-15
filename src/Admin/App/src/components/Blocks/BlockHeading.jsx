import React, { memo } from 'react';
import clsx from 'clsx';

const BlockHeading = ({ title, controls, className = '' }) => {
  return (
    <div
      className={clsx(
        className,
        'flex min-h-16 items-center justify-between px-6 gap-4'
      )}
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      {controls}
    </div>
  );
};

BlockHeading.displayName = 'BlockHeading';

export default memo( BlockHeading );
