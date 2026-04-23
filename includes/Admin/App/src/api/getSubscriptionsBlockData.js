import { getData } from '../utils/api';
import { __, _n, sprintf } from '@wordpress/i18n';
import { formatCurrency, formatCurrencyCompact, formatPercentage } from '../utils/formatting';

const METRIC_KEYS = {
	AVERAGE_LIFETIME_VALUE: 'average_lifetime_value',
	REVENUE_CHURN: 'revenue_churn',
	ACTIVE_SUBSCRIPTIONS: 'active_subscriptions',
	CANCELED_SUBSCRIPTIONS: 'canceled_subscriptions',
	MONTHLY_RECURRING_REVENUE: 'monthly_recurring_revenue'
};

const CHANGE_STATUS = {
	POSITIVE: 'positive',
	NEGATIVE: 'negative'
};

const DEFAULT_METRIC_STATE = {
	value: '-',
	exactValue: null,
	subtitle: '-',
	changeStatus: null,
	change: '-',
	tooltipText: null
};

/**
 * Get subscription metrics
 *
 * @param {Object} args           - The arguments object.
 * @param {string} args.startDate - The start date for the data range.
 * @param {string} args.endDate   - The end date for the data range.
 * @param {string} args.range     - The range of data to retrieve.
 * @param {Object} args.filters   - Additional filters to apply to the data.
 *
 * @return {Promise<*>} The formatted subscription metrics.
 */
const getSubscriptionsBlockData = async( args ) => {
	const { startDate, endDate, range, filters } = args;

	try {
		const { data } = await getData(
			'ecommerce/subscriptions',
			startDate,
			endDate,
			range,
			{ filters }
		);

		return transformSubscriptionData( data );
	} catch ( error ) {
		console.error( 'Error fetching subscription data:', error );
		return null;
	}
};

/**
 * Transform raw subscription data into display-ready format
 *
 * @param {Object} data - Raw subscription data from API
 * @return {Object|null} Transformed subscription metrics
 */
const transformSubscriptionData = ( data ) => {
	if ( ! data ) {
		return null;
	}

	const transformed = {};

	Object.entries( data ).forEach( ([ key, metric ]) => {
		transformed[ key ] = transformMetric( key, metric );
	});

	return transformed;
};

/**
 * Transform a single metric
 *
 * @param {string} key    - Metric key
 * @param {Object} metric - Metric data
 * @return {Object} Transformed metric
 */
const transformMetric = ( key, metric ) => {
	const baseMetric = {
		title: metric?.label ?? '',
		...DEFAULT_METRIC_STATE,
		subtitle: getDefaultSubtitle( key )
	};

	if ( ! metric || ! metric.label ) {
		return baseMetric;
	}

	const { current, previous, rate_change: rateChange } = metric;

	const changeData = calculateChange( key, current, previous, rateChange );

	const metricSpecificData = getMetricSpecificData( key, metric );

	return {
		...baseMetric,
		...changeData,
		...metricSpecificData
	};
};

/**
 * Get default subtitle for a metric key
 *
 * @param {string} key - Metric key
 * @return {string} Default subtitle text
 */
const getDefaultSubtitle = ( key ) => {
	const subtitles = {
		[ METRIC_KEYS.AVERAGE_LIFETIME_VALUE ]: __( 'No subscription data available', 'burst-statistics' ),
		[ METRIC_KEYS.ACTIVE_SUBSCRIPTIONS ]: __( 'No subscription data available', 'burst-statistics' ),
		[ METRIC_KEYS.CANCELED_SUBSCRIPTIONS ]: __( 'No cancellation data available', 'burst-statistics' ),
		[ METRIC_KEYS.REVENUE_CHURN ]: __( 'No churn data available', 'burst-statistics' ),
		[ METRIC_KEYS.MONTHLY_RECURRING_REVENUE ]: __( 'No revenue data available', 'burst-statistics' )
	};

	return subtitles[ key ] ?? __( 'No data available', 'burst-statistics' );
};

/**
 * Get the current value for a metric key
 *
 * @param {string} key     - The metric key
 * @param {Object} current - The current data object
 * @return {number} The current value
 */
const getCurrentValue = ( key, current ) => {
	const valueExtractors = {
		[ METRIC_KEYS.AVERAGE_LIFETIME_VALUE ]: () => current?.value ?? 0,
		[ METRIC_KEYS.REVENUE_CHURN ]: () => getRevenueChurnPercentage( current ),
		[ METRIC_KEYS.ACTIVE_SUBSCRIPTIONS ]: () => current ?? 0,
		[ METRIC_KEYS.CANCELED_SUBSCRIPTIONS ]: () => current ?? 0,
		[ METRIC_KEYS.MONTHLY_RECURRING_REVENUE ]: () => current?.mrr ?? 0
	};

	return valueExtractors[ key ] ? valueExtractors[ key ]() : 0;
};

/**
 * Get the previous value for a metric key
 *
 * @param {string} key      - The metric key
 * @param {Object} previous - The previous data object
 * @return {number} The previous value
 */
const getPreviousValue = ( key, previous ) => {
	const valueExtractors = {
		[ METRIC_KEYS.AVERAGE_LIFETIME_VALUE ]: () => previous?.value ?? 0,
		[ METRIC_KEYS.REVENUE_CHURN ]: () => getRevenueChurnPercentage( previous ),
		[ METRIC_KEYS.ACTIVE_SUBSCRIPTIONS ]: () => previous ?? 0,
		[ METRIC_KEYS.CANCELED_SUBSCRIPTIONS ]: () => previous ?? 0,
		[ METRIC_KEYS.MONTHLY_RECURRING_REVENUE ]: () => previous?.mrr ?? 0
	};

	return valueExtractors[ key ] ? valueExtractors[ key ]() : 0;
};

/**
 * Check if metric should be inverted (lower is better)
 *
 * @param {string} key - Metric key
 * @return {boolean} True if metric should be inverted
 */
const isInvertedMetric = ( key ) => {
	return key === METRIC_KEYS.REVENUE_CHURN || key === METRIC_KEYS.CANCELED_SUBSCRIPTIONS;
};

/**
 * Calculate change data for a metric
 *
 * @param {string} key        - Metric key
 * @param {Object} current    - Current period data
 * @param {Object} previous   - Previous period data
 * @param {number} rateChange - Rate of change
 * @return {Object} Change data with change and changeStatus
 */
const calculateChange = ( key, current, previous, rateChange ) => {
	const isInverted = isInvertedMetric( key );

	if ( METRIC_KEYS.REVENUE_CHURN === key && ! hasRevenueChurnBaseline( current ) ) {
		return {
			change: '-',
			changeStatus: null
		};
	}

	// Use rate_change if provided
	if ( null !== rateChange && undefined !== rateChange ) {
		return calculateChangeFromRate( rateChange, isInverted );
	}

	// Calculate from current and previous values
	if ( current || previous ) {
		const currentValue = getCurrentValue( key, current );
		const previousValue = getPreviousValue( key, previous );
		return calculateChangeFromValues( currentValue, previousValue, isInverted );
	}

	// Default: no change
	return {
		change: '0%',
		changeStatus: CHANGE_STATUS.POSITIVE
	};
};

/**
 * Calculate change from rate
 *
 * @param {number}  rateChange  - Rate of change
 * @param {boolean} isInverted  - Whether metric is inverted
 * @return {Object} Change data
 */
const calculateChangeFromRate = ( rateChange, isInverted ) => {
	if ( 0 === rateChange ) {
		return {
			change: '0%',
			changeStatus: CHANGE_STATUS.POSITIVE
		};
	}

	const formatted = formatPercentage( rateChange );
	const isPositiveChange = 0 < rateChange;

	return {
		change: isPositiveChange ? `+${ formatted }` : formatted,
		changeStatus: determineChangeStatus( isPositiveChange, isInverted )
	};
};

/**
 * Calculate change from current and previous values
 *
 * @param {number}  currentValue  - Current value
 * @param {number}  previousValue - Previous value
 * @param {boolean} isInverted    - Whether metric is inverted
 * @return {Object} Change data
 */
const calculateChangeFromValues = ( currentValue, previousValue, isInverted ) => {

	// From zero to positive
	if ( 0 === previousValue && 0 < currentValue ) {
		return {
			change: '∞',
			changeStatus: determineChangeStatus( true, isInverted )
		};
	}

	// From positive to zero
	if ( 0 < previousValue && 0 === currentValue ) {
		return {
			change: '-∞',
			changeStatus: determineChangeStatus( false, isInverted )
		};
	}

	// No change
	return {
		change: '0%',
		changeStatus: CHANGE_STATUS.POSITIVE
	};
};

/**
 * Determine change status based on direction and inversion
 *
 * @param {boolean} isPositiveChange - Whether change is positive
 * @param {boolean} isInverted       - Whether metric is inverted
 * @return {string} Change status
 */
const determineChangeStatus = ( isPositiveChange, isInverted ) => {
	if ( isInverted ) {
		return isPositiveChange ? CHANGE_STATUS.NEGATIVE : CHANGE_STATUS.POSITIVE;
	}
	return isPositiveChange ? CHANGE_STATUS.POSITIVE : CHANGE_STATUS.NEGATIVE;
};

/**
 * Get metric-specific data
 *
 * @param {string} key    - Metric key
 * @param {Object} metric - Metric data
 * @return {Object} Metric-specific data
 */
const getMetricSpecificData = ( key, metric ) => {
	const handlers = {
		[ METRIC_KEYS.AVERAGE_LIFETIME_VALUE ]: getAverageLifetimeValueData,
		[ METRIC_KEYS.REVENUE_CHURN ]: getRevenueChurnData,
		[ METRIC_KEYS.ACTIVE_SUBSCRIPTIONS ]: getActiveSubscriptionsData,
		[ METRIC_KEYS.CANCELED_SUBSCRIPTIONS ]: getCanceledSubscriptionsData,
		[ METRIC_KEYS.MONTHLY_RECURRING_REVENUE ]: getMonthlyRecurringRevenueData
	};

	const handler = handlers[ key ];
	return handler ? handler( metric ) : {};
};

/**
 * Get Average Lifetime Value specific data
 *
 * @param {Object} metric - Metric data
 * @return {Object} Formatted metric data
 */
const getAverageLifetimeValueData = ( metric ) => {
	const data = {
		icon: 'gem'
	};

	if ( ! metric.current ) {
		return data;
	}

	const { currency, current } = metric;
	const lifetimeValue = current.value ?? 0;
	const subscriptionCount = parseInt( current.active_subscription_count, 10 ) || 0;

	return {
		...data,
		value: formatCurrencyCompact( currency, lifetimeValue ),
		exactValue: lifetimeValue,
		tooltipText: formatCurrency( currency, lifetimeValue ),
		subtitle: getLifetimeValueSubtitle( subscriptionCount )
	};
};

/**
 * Get subtitle for lifetime value metric
 *
 * @param {number} subscriptionCount - Number of subscriptions
 * @return {string} Subtitle text
 */
const getLifetimeValueSubtitle = ( subscriptionCount ) => {
	if ( 0 >= subscriptionCount ) {
		return __( 'No active subscriptions', 'burst-statistics' );
	}

	return sprintf(
		_n(
			'From %d customer',
			'From %d customers',
			subscriptionCount,
			'burst-statistics'
		),
		subscriptionCount
	);
};

/**
 * Get Revenue Churn specific data
 *
 * @param {Object} metric - Metric data
 * @return {Object} Formatted metric data
 */
const getRevenueChurnData = ( metric ) => {
	const data = {
		icon: 'trending-down'
	};

	if ( ! metric.current ) {
		return data;
	}

	const { current, previous, rate_change: rateChange } = metric;
	if ( ! hasRevenueChurnBaseline( current ) ) {
		return {
			...data,
			value: __( 'N/A', 'burst-statistics' ),
			exactValue: null,
			tooltipText: __( 'N/A', 'burst-statistics' ),
			subtitle: __( 'Not available for this period', 'burst-statistics' )
		};
	}

	const churnPercentage = getRevenueChurnPercentage( current );

	return {
		...data,
		value: formatPercentage( churnPercentage ),
		exactValue: churnPercentage,
		tooltipText: formatPercentage( churnPercentage ),
		subtitle: getRevenueChurnSubtitle( current, previous, rateChange )
	};
};

/**
 * Get revenue churn percentage from a churn payload.
 * Expects strict payload shape with { churned_percentage }.
 *
 * @param {Object|null} churnData Churn payload.
 * @return {number} Churn percentage value.
 */
const getRevenueChurnPercentage = ( churnData ) => {
	if ( ! churnData ) {
		return 0;
	}

	if ( undefined !== churnData.churned_percentage ) {
		return parseFloat( churnData.churned_percentage ) || 0;
	}

	return 0;
};

/**
 * Whether churn can be calculated for this period.
 *
 * @param {Object|null} churnData Churn payload.
 * @return {boolean} True when baseline exists.
 */
const hasRevenueChurnBaseline = ( churnData ) => {
	const baseline = parseInt( churnData?.previously_active_count, 10 ) || 0;
	return 0 < baseline;
};

/**
 * Get subtitle for revenue churn metric
 *
 * @param {Object} current    - Current period data
 * @param {Object} previous   - Previous period data
 * @param {?number} rateChange - Relative rate change value from API
 * @return {string} Subtitle text
 */
const getRevenueChurnSubtitle = ( current, previous, rateChange ) => {
	if ( null !== rateChange && undefined !== rateChange ) {
		if ( 0 === rateChange ) {
			return __( 'No change from last period', 'burst-statistics' );
		}

		const direction = 0 < rateChange ?
			__( 'Up %s from last period', 'burst-statistics' ) :
			__( 'Down %s from last period', 'burst-statistics' );

		return sprintf( direction, formatPercentage( Math.abs( rateChange ) ) );
	}

	const churnPercentage = getRevenueChurnPercentage( current );

	// Compare with previous period if available
	if ( previous && ( undefined !== previous.churned_percentage ) ) {
		const previousPercentage = getRevenueChurnPercentage( previous );
		const difference = churnPercentage - previousPercentage;

		if ( 0 === difference ) {
			return __( 'No change from last period', 'burst-statistics' );
		}

		const direction = 0 < difference ?
			__( 'Up %s from last period', 'burst-statistics' ) :
			__( 'Down %s from last period', 'burst-statistics' );

		return sprintf(
			direction,
			formatPercentage( Math.abs( difference ) )
		);
	}

	// Fall back to an absolute percentage subtitle when no comparison period is available.
	return sprintf(
		__( 'Current period churn: %s', 'burst-statistics' ),
		formatPercentage( churnPercentage )
	);
};

/**
 * Get Active Subscriptions specific data
 *
 * @param {Object} metric - Metric data
 * @return {Object} Formatted metric data
 */
const getActiveSubscriptionsData = ( metric ) => {
	const data = {
		icon: 'user-check'
	};

	if ( ! metric.current ) {
		return data;
	}

	const { current, previous } = metric;
	const activeCount = parseInt( current, 10 ) || 0;

	return {
		...data,
		value: activeCount.toLocaleString(),
		exactValue: activeCount,
		subtitle: getActiveSubscriptionsSubtitle( activeCount, previous )
	};
};

/**
 * Get subtitle for active subscriptions metric
 *
 * @param {number} activeCount - Current active count
 * @param {Object} previous    - Previous period data
 * @return {string} Subtitle text
 */
const getActiveSubscriptionsSubtitle = ( activeCount, previous ) => {

	// Compare with previous period if available
	if ( previous && undefined !== previous.count ) {
		const previousCount = parseInt( previous, 10 ) || 0;
		const difference = activeCount - previousCount;

		if ( 0 === difference ) {
			return __( 'No change from last period', 'burst-statistics' );
		}

		const abs = Math.abs( difference );
		const text = 0 < difference ?
			_n( '%d new subscription', '%d new subscriptions', abs, 'burst-statistics' ) :
			_n( '%d subscription canceled', '%d subscriptions canceled', abs, 'burst-statistics' );

		return sprintf( text, abs );
	}

	// Fall back to current count
	if ( 0 >= activeCount ) {
		return __( 'No active subscriptions', 'burst-statistics' );
	}

	return sprintf(
		_n(
			'%d active subscription',
			'%d active subscriptions',
			activeCount,
			'burst-statistics'
		),
		activeCount
	);
};

/**
 * Get Canceled Subscriptions specific data
 *
 * @param {Object} metric - Metric data
 * @return {Object} Formatted metric data
 */
const getCanceledSubscriptionsData = ( metric ) => {
	const data = {
		icon: 'user-x'
	};

	if ( ! metric.current ) {
		return data;
	}

	const { current, previous } = metric;
	const canceledCount = parseInt( current, 10 ) || 0;

	return {
		...data,
		value: canceledCount.toLocaleString(),
		exactValue: canceledCount,
		subtitle: getCanceledSubscriptionsSubtitle( canceledCount, previous )
	};
};

/**
 * Get subtitle for canceled subscriptions metric
 *
 * @param {number} canceledCount - Current canceled count
 * @param {Object} previous      - Previous period data
 * @return {string} Subtitle text
 */
const getCanceledSubscriptionsSubtitle = ( canceledCount, previous ) => {

	// Compare with previous period if available
	if ( previous && undefined !== previous.count ) {
		const previousCount = parseInt( previous, 10 ) || 0;
		const difference = canceledCount - previousCount;

		if ( 0 === difference ) {
			return __( 'No change from last period', 'burst-statistics' );
		}

		const abs = Math.abs( difference );
		const text = 0 < difference ?
			_n( '%d new cancellation', '%d new cancellations', abs, 'burst-statistics' ) :
			_n( '%d cancellation reversed', '%d cancellations reversed', abs, 'burst-statistics' );

		return sprintf( text, abs );
	}

	// Fall back to current count
	if ( 0 >= canceledCount ) {
		return __( 'No canceled subscriptions', 'burst-statistics' );
	}

	return sprintf(
		_n(
			'%d canceled subscription',
			'%d canceled subscriptions',
			canceledCount,
			'burst-statistics'
		),
		canceledCount
	);
};

/**
 * Get Monthly Recurring Revenue specific data
 *
 * @param {Object} metric - Metric data
 * @return {Object} Formatted metric data
 */
const getMonthlyRecurringRevenueData = ( metric ) => {
	const data = {
		icon: 'calendar-sync'
	};

	if ( ! metric.current ) {
		return data;
	}

	const { currency, current, previous } = metric;
	const mrr = current.mrr ?? 0;

	return {
		...data,
		value: formatCurrencyCompact( currency, mrr ),
		exactValue: mrr,
		tooltipText: formatCurrency( currency, mrr ),
		subtitle: getMonthlyRecurringRevenueSubtitle( current, previous, currency )
	};
};

/**
 * Get subtitle for monthly recurring revenue metric
 *
 * @param {Object} current  - Current period data
 * @param {Object} previous - Previous period data
 * @param {string} currency - Currency code
 * @return {string} Subtitle text
 */
const getMonthlyRecurringRevenueSubtitle = ( current, previous, currency ) => {
	const mrr = current.mrr ?? 0;

	// Compare with previous period if available
	if ( previous && undefined !== previous.mrr ) {
		const previousMrr = parseFloat( previous.mrr ) || 0;
		const difference = mrr - previousMrr;

		if ( 0 === difference ) {
			return __( 'No change from last period', 'burst-statistics' );
		}

		const direction = 0 < difference ?
			__( 'Up %s from last period', 'burst-statistics' ) :
			__( 'Down %s from last period', 'burst-statistics' );

		return sprintf(
			direction,
			formatCurrencyCompact( currency, Math.abs( difference ), { currencyDisplay: 'narrowSymbol' })
		);
	}

	// Fall back to subscription count
	const subscriptionCount = parseInt( current.count, 10 ) || 0;

	if ( 0 >= subscriptionCount ) {
		return __( 'No active subscriptions', 'burst-statistics' );
	}

	return sprintf(
		_n(
			'%d active subscription',
			'%d active subscriptions',
			subscriptionCount,
			'burst-statistics'
		),
		subscriptionCount
	);
};

export default getSubscriptionsBlockData;
