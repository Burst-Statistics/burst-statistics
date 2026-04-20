import { memo, ReactNode } from 'react';
import clsx from 'clsx';
import { LoadingSpinner } from '@/components/Common/LoadingSpinner';

type BlockHeadingStandardProps = {
	title: ReactNode;
	controls?: ReactNode;
	className?: string;
	isLoading?: boolean;
};

/**
 * Standard block heading for dashboard and regular views.
 *
 * @param {Object}           props           - Component props.
 * @param {React.ReactNode}  props.title     - The heading title.
 * @param {React.ReactNode}  props.controls  - Optional controls to render on the right side.
 * @param {string}           props.className - Additional CSS classes.
 * @param {boolean}          props.isLoading - Whether the block is currently loading.
 * @return {JSX.Element} The block heading component.
 */
export const BlockHeadingStandard = memo( ({ title, controls, className = '', isLoading = false }: BlockHeadingStandardProps ) => {
	return (
		<div
			className={clsx(
				className,
				'flex min-h-14 items-center justify-between px-2.5 md:px-6 md:min-h-16 gap-4'
			)}
		>
			<div className="flex items-center gap-2.5 min-w-0">
				<h2 className="text-lg font-semibold">{title}</h2>
				{isLoading && <LoadingSpinner />}
			</div>

			{controls}
		</div>
	);
});

BlockHeadingStandard.displayName = 'BlockHeadingStandard';
