import { getData } from '../utils/api';

/**
 * Get live traffic
 */
const getLiveTraffic = async() => {
	const { data } = await getData( 'live-traffic' );
	return data;
};
export default getLiveTraffic;
