/**
 * Subscription Component.
 */
import { useDate } from '@/store/useDateStore';
import { useFilters } from '@/hooks/useFilters';
import { useQuery } from '@tanstack/react-query';
import { __ } from '@wordpress/i18n';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import { BlockFooter } from '@/components/Blocks/BlockFooter';
import SalesFooter from '@/components/Sales/SalesFooter';
import ExplanationAndStatsItem from '@/components/Common/ExplanationAndStatsItem';
import getSubscriptionsBlockData from '@/api/getSubscriptionsBlockData';

/**
 * Individual subscription metric data.
 */
interface SubscriptionMetric {
	title: string;
	subtitle: string | null;
	value: string;
	exactValue: number | null;
	change: string | null;
	changeStatus: 'positive' | 'negative' | null;
	icon?: string;
	tooltipText: string | null;
}

/**
 * Subscription data interface mapping metric keys to their data.
 */
interface SubscriptionData {
	monthly_recurring_revenue?: SubscriptionMetric;
	active_subscriptions?: SubscriptionMetric;
	canceled_subscriptions?: SubscriptionMetric;
	revenue_churn?: SubscriptionMetric;
	average_lifetime_value?: SubscriptionMetric;
	[key: string]: SubscriptionMetric | undefined;
}

/**
 * Default placeholder data for subscription metrics.
 * Used while data is loading or unavailable.
 */
const PLACEHOLDER_DATA: SubscriptionData = {
	monthly_recurring_revenue: {
		title: __( 'Monthly Recurring Revenue', 'burst-statistics' ),
		value: '-',
		exactValue: null,
		subtitle: '-',
		changeStatus: null,
		change: '-',
		icon: 'calendar-sync',
		tooltipText: null
	},
	active_subscriptions: {
		title: __( 'Active Subscriptions', 'burst-statistics' ),
		value: '-',
		exactValue: null,
		subtitle: '-',
		changeStatus: null,
		change: '-',
		icon: 'user-check',
		tooltipText: null
	},
	canceled_subscriptions: {
		title: __( 'Canceled Subscriptions', 'burst-statistics' ),
		value: '-',
		exactValue: null,
		subtitle: '-',
		changeStatus: null,
		change: '-',
		icon: 'user-x',
		tooltipText: null
	},
	revenue_churn: {
		title: __( 'Revenue Churn', 'burst-statistics' ),
		value: '-',
		exactValue: null,
		subtitle: '-',
		changeStatus: null,
		change: '-',
		icon: 'trending-down',
		tooltipText: null
	},
	average_lifetime_value: {
		title: __( 'Average Lifetime Value', 'burst-statistics' ),
		value: '-',
		exactValue: null,
		subtitle: '-',
		changeStatus: null,
		change: '-',
		icon: 'gem',
		tooltipText: null
	}
};

/**
 * Query configuration constants.
 */
const QUERY_CONFIG = {
	STALE_TIME: 5 * 60 * 1000, // 5 minutes
	GC_TIME: 10 * 60 * 1000 // 10 minutes
} as const;

/**
 * SubscriptionsBlock component.
 * Displays subscription metrics including MRR, active/canceled subscriptions,
 * revenue churn, and average lifetime value.
 *
 * @return {JSX.Element} The SubscriptionsBlock component.
 */
const SubscriptionsBlock = (): JSX.Element => {
	const { startDate, endDate, range } = useDate( ( state ) => state );
	const { filters } = useFilters();

	const subscriptionsQuery = useQuery<SubscriptionData | null>({
		queryKey: [ 'subscriptions', startDate, endDate, range, filters ],
		queryFn: () => getSubscriptionsBlockData({ startDate, endDate, range, filters }),
		placeholderData: PLACEHOLDER_DATA,
		staleTime: QUERY_CONFIG.STALE_TIME,
		gcTime: QUERY_CONFIG.GC_TIME
	});

	let subscriptions = PLACEHOLDER_DATA;

	if ( subscriptionsQuery.data && 0 < Object.keys( subscriptionsQuery.data ).length ) {
		subscriptions = subscriptionsQuery.data;
	}

	const blockHeadingProps = {
		title: __( 'Subscriptions', 'burst-statistics' ),
		isLoading: subscriptionsQuery.isFetching
	};

	return (
		<Block className="row-span-1 lg:col-span-6 xl:col-span-3 block-subscriptions">
			<BlockHeading {...blockHeadingProps} />

			<BlockContent>
				{ subscriptions &&
					Object.entries( subscriptions ).map( ([ key, metric ]) => {
						if ( ! metric ) {
							return null;
						}

						return (
							<ExplanationAndStatsItem
								key={ key }
								{ ...( metric.icon && { iconKey: metric.icon }) }
								title={ metric.title }
								subtitle={ metric.subtitle }
								value={ metric.value }
								exactValue={ metric.exactValue }
								change={ metric.change }
								changeStatus={ metric.changeStatus }
								tooltipText={ metric.tooltipText }
								className={ key }
							/>
						);
					}) }
			</BlockContent>

			<BlockFooter>
				<SalesFooter startDate={ startDate } endDate={ endDate } />
			</BlockFooter>
		</Block>
	);
};

export default SubscriptionsBlock;
