import { useQuery } from '@tanstack/react-query';
import { __, sprintf } from '@wordpress/i18n';
import getSubscriptionsProgressData from '@/api/getSubscriptionsProgressData';
import Icon from '@/utils/Icon';
import { formatNumber } from '@/utils/formatting';

const SubscriptionsLargeSiteNotice = () => {
	const { data, isError } = useQuery({
		queryKey: [ 'subscriptions-backfill-progress' ],
		queryFn: () => getSubscriptionsProgressData(),

		// Route owns the refetch schedule; this just reads the shared cache.
		refetchInterval: false,
		refetchIntervalInBackground: false
	});

	const backfillCompleted = !! data?.backfill_completed;
	const isLargeSite = !! data?.is_large_site;
	const isProcessing = !! data?.is_processing;

	if ( ! isError && backfillCompleted && ! isProcessing && ! isLargeSite ) {
		return null;
	}

	const progress = Math.max(
		0,
		Math.min( 100, parseInt( data?.progress, 10 ) || 0 )
	);
	const visualProgress = Math.max( progress, isProcessing ? 1 : 0 );
	const rawCount = parseInt( data?.subscription_count, 10 );
	const hasCount = Number.isFinite( rawCount ) && 0 < rawCount;
	const formattedCount = hasCount ?
		formatNumber( rawCount, 0, false ) :
		__( 'many', 'burst-statistics' );

	const heading = isLargeSite ?
		__( 'Large subscription dataset detected', 'burst-statistics' ) :
		__( 'Preparing your subscriptions dashboard', 'burst-statistics' );

	const description = isLargeSite ?
		sprintf(

			/* translators: %s: formatted subscription count, e.g. "52,431". */
			__(
				'You have %s subscriptions. To keep the dashboard fast and avoid memory exhaustion, summary metrics are only shown after the daily aggregation has been built. Please wait for the backfill to finish.',
				'burst-statistics'
			),
			formattedCount
		) :
		__(
			'Subscription metrics are built from a daily aggregation table. The first time you load this page we backfill historical data in the background — this only happens once. Charts and totals will appear here as soon as it finishes.',
			'burst-statistics'
		);

	return (
		<div className="col-span-12 flex flex-col rounded-xl border border-gray-200 bg-white p-6 shadow-xs dark:border-gray-100 @sm:p-8">
			<div className="flex items-start gap-4">
				<Icon
					name="help"
					size={24}
					color="blue"
					className="mt-1 shrink-0"
				/>
				<div className="flex-1">
					<h2 className="mb-2 text-lg font-semibold text-text-black dark:text-text-white @sm:text-xl">
						{heading}
					</h2>
					<p className="mb-3 text-text-gray dark:text-text-white">
						{description}
					</p>
					<p className="text-sm text-text-gray dark:text-text-white">
						{isProcessing ?
							__(
								'Backfill is currently running in the background. This page will refresh automatically.',
								'burst-statistics'
							) :
							__(
								'Backfill will start automatically on the next scheduled cron run.',
								'burst-statistics'
							)}
					</p>
				</div>
			</div>

			<div className="mt-6">
				<div className="h-2 min-h-[8px] w-full overflow-hidden rounded-sm bg-gray-300 dark:bg-gray-500">
					<div
						className="relative block h-full min-h-[8px] bg-primary transition-[width] duration-700 ease-out"
						style={{ width: `${visualProgress}%` }}
						role="progressbar"
						aria-valuemin={0}
						aria-valuemax={100}
						aria-valuenow={progress}
						aria-label={__(
							'Subscriptions backfill progress',
							'burst-statistics'
						)}
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

				<div className="mt-2 flex items-center justify-between gap-3 text-sm font-medium text-text-black dark:text-text-white">
					<span>
						{isProcessing ?
							__(
								'Building subscriptions summary table…',
								'burst-statistics'
							) :
							__(
								'Waiting for backfill to start…',
								'burst-statistics'
							)}
					</span>
					<span className="shrink-0 font-semibold">{progress}%</span>
				</div>
			</div>
		</div>
	);
};

SubscriptionsLargeSiteNotice.displayName = 'SubscriptionsLargeSiteNotice';

export default SubscriptionsLargeSiteNotice;
