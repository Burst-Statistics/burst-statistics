import type { ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { formatNumber } from '@/utils/formatting';

interface SearchQueriesProgressProps {
	children: ReactNode;
	readyDays: number;
	totalDays: number;
	className?: string;
}

/**
 * Shows determinate progress while Search Console dates are fetched in the
 * background.
 */
export const SearchQueriesProgress = ({
	children,
	readyDays,
	totalDays,
	className = ''
}: SearchQueriesProgressProps ) => {
	const boundedTotal = Math.max( 0, totalDays );
	const boundedReady = Math.min( Math.max( 0, readyDays ), boundedTotal );
	const progress = 0 < boundedTotal ?
		( boundedReady / boundedTotal ) * 100 :
		0;

	return (
		<div className={ className }>
			<p className="m-0 text-sm text-text-gray-light">
				{ children }
			</p>
			{0 < boundedTotal && (
				<div
					className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100"
					role="progressbar"
					aria-valuemin={ 0 }
					aria-valuemax={ boundedTotal }
					aria-valuenow={ boundedReady }
					aria-valuetext={ sprintf(

						/* translators: 1: number of fetched days, 2: total days in the selected range. */
						__( '%1$s of %2$s days fetched', 'burst-statistics' ),
						formatNumber( boundedReady, 0, false ),
						formatNumber( boundedTotal, 0, false )
					) }
				>
					<div
						className="h-full rounded-full bg-green transition-[width] duration-700 ease-out motion-reduce:transition-none"
						style={{ width: `${ progress }%` }}
					/>
				</div>
			) }
		</div>
	);
};
