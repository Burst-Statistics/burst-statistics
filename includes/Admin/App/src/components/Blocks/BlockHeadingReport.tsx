import { memo, useMemo, ReactNode } from 'react';
import clsx from 'clsx';
import { useBlockHeadingData } from '@/hooks/useBlockHeadingData';

type BlockHeadingReportProps = {
	title: ReactNode;
	controls?: ReactNode;
	className?: string;
	reportBlockIndex?: number;
};

/**
 * Report-specific block heading for story/report views.
 *
 * @param {Object} props - Component props.
 * @param {string} props.title - The heading title.
 * @param {React.ReactNode} props.controls - Optional controls to render on the right side.
 * @param {string} props.className - Additional CSS classes.
 * @param {number} props.reportBlockIndex - Index of the block in the report's content array.
 * @return {JSX.Element} The block heading component.
 */
export const BlockHeadingReport = memo( ({ title, controls, className = '', reportBlockIndex }: BlockHeadingReportProps ) => {
	const { dateRangeText, filtersText, hasDateRange, hasFilters } = useBlockHeadingData( reportBlockIndex );

	// Build subtitle text
	const subtitle = useMemo( () => {
		if ( hasDateRange && hasFilters ) {
			return `${dateRangeText} • ${filtersText}`;
		}
		if ( hasDateRange ) {
			return dateRangeText;
		}
		if ( hasFilters ) {
			return filtersText;
		}
		return null;
	}, [ dateRangeText, filtersText, hasDateRange, hasFilters ]);

	return (
		<div
			className={clsx(
				className,
				'flex min-h-14 items-center justify-between px-2.5 md:px-6 md:min-h-16 gap-4'
			)}
		>
			<div className="flex flex-col">
				<h2 className="text-lg font-semibold">{title}</h2>
				{subtitle && <p className="text-sm text-text-gray">{subtitle}</p>}
			</div>
			{controls}
		</div>
	);
});

BlockHeadingReport.displayName = 'BlockHeadingReport';
