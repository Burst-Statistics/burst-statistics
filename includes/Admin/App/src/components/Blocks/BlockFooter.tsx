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
	return (
		<div
			className={clsx(
				className,
				'flex items-center justify-between px-2.5 py-3 md:px-6'
			)}
		>
			{children}
		</div>
	);
});

BlockFooter.displayName = 'BlockFooter';
