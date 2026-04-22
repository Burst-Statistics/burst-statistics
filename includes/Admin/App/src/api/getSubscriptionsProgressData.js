import { getAction } from '../utils/api';

/**
 * Fetch subscriptions summary backfill progress.
 *
 * @return {Promise<Object>}
 */
const getSubscriptionsProgressData = async() => {
	return await getAction( 'ecommerce/get_subscriptions_backfill_progress' );
};

export default getSubscriptionsProgressData;
