import { memo, ReactNode } from 'react';
import clsx from 'clsx';

type BlockFooterProps = {
	children: ReactNode;
	className?: string;
};

/**
 * Block Footer Component.
 *
 * @param {Object} props - Component props.
 * @param {React.ReactNode} props.children - The footer content.
 * @param {string} props.className - Additional CSS classes.
 * @return {JSX.Element} The block footer component.
 */
export const BlockFooter = memo( ({ children, className = '' }: BlockFooterProps ) => {
	const hasJustify = className.includes( 'justify-' );
	return (
		<div
			className={clsx(
				'flex items-center px-2.5 py-3 md:px-6',
				! hasJustify && 'justify-between',
				className
			)}
		>
			{children}
		</div>
	);
});

BlockFooter.displayName = 'BlockFooter';
