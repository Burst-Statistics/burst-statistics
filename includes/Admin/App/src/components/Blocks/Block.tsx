import clsx from 'clsx';
import ErrorBoundary from '../Common/ErrorBoundary';
import { memo } from 'react';
import { useDeferredMount } from '@/hooks/useDeferredMount';

type BlockProps = React.ComponentPropsWithoutRef<'div'> & {
	className?: string;
	children: React.ReactNode;
};

export const Block = memo( ({ className = '', children, ...props }: BlockProps ) => {

	// Children — and thus their data queries — mount when the block is
	// (nearly) in view, or after a grace period for background loading.
	// Off-screen blocks no longer compete with visible ones for the
	// browser's connection budget on first paint.
	const { ref, mounted } = useDeferredMount();

	return (
		<ErrorBoundary>
			<div
				ref={ref}
				className={clsx(
					'col-span-12 flex flex-col rounded-xl bg-white shadow-xs relative border dark:border-gray-100 border-gray-200 @container',
					! mounted && 'min-h-52',
					className // later so should override the above
				)}
				{...props}
			>
				{mounted ? children : null}
			</div>
		</ErrorBoundary>
	);
});

Block.displayName = 'Block';
