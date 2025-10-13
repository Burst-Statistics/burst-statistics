import { getData } from '../utils/api';
import { formatNumber } from '../utils/formatting';

/**
 * Get live traffic
 */
const getLiveTraffic = async() => {
    const { data } = await getData( 'live-traffic' );
    return data;
};
export default getLiveTraffic;
