import { memo, ReactNode } from 'react';
import clsx from 'clsx';

type BlockHeadingStandardProps = {
	title: string;
	controls?: ReactNode;
	className?: string;
};

/**
 * Standard block heading for dashboard and regular views.
 *
 * @param {Object} props - Component props.
 * @param {string} props.title - The heading title.
 * @param {React.ReactNode} props.controls - Optional controls to render on the right side.
 * @param {string} props.className - Additional CSS classes.
 * @return {JSX.Element} The block heading component.
 */
export const BlockHeadingStandard = memo( ({ title, controls, className = '' }: BlockHeadingStandardProps ) => {
	return (
		<div
			className={clsx(
				className,
				'flex min-h-14 items-center justify-between px-2.5 md:px-6 md:min-h-16 gap-4'
			)}
		>
			<h2 className="text-lg font-semibold">{title}</h2>

			{controls}
		</div>
	);
});

BlockHeadingStandard.displayName = 'BlockHeadingStandard';
