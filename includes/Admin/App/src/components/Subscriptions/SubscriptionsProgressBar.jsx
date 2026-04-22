import { useQuery } from '@tanstack/react-query';
import { __ } from '@wordpress/i18n';
import getSubscriptionsProgressData from '@/api/getSubscriptionsProgressData';

const SubscriptionsProgressBar = () => {
	const { data } = useQuery({
		queryKey: [ 'subscriptions-backfill-progress' ],
		queryFn: () => getSubscriptionsProgressData(),
		refetchInterval: 60000,
		refetchIntervalInBackground: true
	});

	const isBackfillProcessing = !! data?.is_processing;
	const progress = Math.max(
		0,
		Math.min( 100, parseInt( data?.progress, 10 ) || 0 )
	);
	const shouldShowProgressBar = isBackfillProcessing || ( 0 < progress && 100 > progress );

	if ( ! shouldShowProgressBar ) {
		return null;
	}

	const visualProgress = Math.max( progress, 1 );

	return (
		<div className="col-span-12 -mt-1">
			<div className="h-1.5 min-h-[6px] w-full overflow-hidden rounded-sm bg-gray-300 dark:bg-gray-500">
				<div
					className="relative block h-full min-h-[6px] bg-primary transition-[width] duration-700 ease-out"
					style={{ width: `${visualProgress}%` }}
					role="progressbar"
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={progress}
					aria-label={__( 'Subscriptions backfill progress', 'burst-statistics' )}
				>
					<span
						className="pointer-events-none absolute inset-y-0 left-0 w-full motion-safe:animate-shimmer motion-reduce:hidden"
						style={{
							background:
								'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.45) 50%, transparent 100%)'
						}}
					/>
				</div>
			</div>

			<div className="mt-2 flex items-center justify-between gap-3 text-xs font-medium text-text-black dark:text-text-white">
				<span>{__( 'Building subscriptions summary table…', 'burst-statistics' )}</span>
				<span className="shrink-0 font-semibold">{progress}%</span>
			</div>
		</div>
	);
};

SubscriptionsProgressBar.displayName = 'SubscriptionsProgressBar';

export default SubscriptionsProgressBar;
