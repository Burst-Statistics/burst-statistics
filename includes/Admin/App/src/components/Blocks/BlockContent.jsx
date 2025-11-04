import React, { memo } from 'react';
import clsx from 'clsx';

/**
 * Block Content Component
 *
 * @param {Object} props Component props.
 * @param {React.ReactNode} props.children Child elements to be rendered inside the block content.
 * @param {string} [props.className] Optional additional class names for custom styling.
 *
 * @returns {JSX.Element} The rendered BlockContent component.
 */
export const BlockContent = memo( ( { children, className = '' } ) => {
	// Check if a custom padding class (e.g., p-2, p-4) is provided in className
	const hasCustomPadding = /\bp-\S+/.test( className );

	return (
	  <div className={ clsx( 'flex-grow', { 'p-6': ! hasCustomPadding }, className ) }>
      { children }
    </div>
	);
});

BlockContent.displayName = 'BlockContent';
