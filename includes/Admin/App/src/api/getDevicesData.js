import { __ } from '@wordpress/i18n';
import { getData } from '@/utils/api';
import {
	getPercentage
} from '@/utils/formatting';

const deviceNames = {
	desktop: __( 'Desktop', 'burst-statistics' ),
	tablet: __( 'Tablet', 'burst-statistics' ),
	mobile: __( 'Mobile', 'burst-statistics' ),
	other: __( 'Other', 'burst-statistics' )
};

// Existing transform function for title and value
const transformDevicesTitleAndValue = ( response ) => {
	const data = {};
	for ( const [ key, value ] of Object.entries( deviceNames ) ) {
		Object.assign( data, {
			[key]: {
				title: value,
				value: getPercentage( response[key].count, response.all.count )
			}
		});
	}
	return data;
};

// New transform function for subtitle
const transformDevicesSubtitle = ( response ) => {
	const data = {};
	for ( const [ key ] of Object.entries( deviceNames ) ) {
		const os = response[key].os ? response[key].os : '';
		const browser = response[key].browser ? response[key].browser : '';
		Object.assign( data, {
			[key]: {
				device_id: response[key].device_id,
				subtitle:
					'' === os && '' === browser ? '-' : os + ' / ' + browser
			}
		});
	}
	return data;
};

/**
 * Get live visitors
 * @param {Object} args
 * @param {string} args.startDate
 * @param {string} args.endDate
 * @param {string} args.range
 * @param {Object} args.filters
 * @param          args.args
 * @return {Promise<*>}
 */
export const getDevicesTitleAndValueData = async({
	startDate,
	endDate,
	range,
	args
}) => {
	const { data } = await getData(
		'devicesTitleAndValue',
		startDate,
		endDate,
		range,
		args
	);
	return transformDevicesTitleAndValue( data );
};

/**
 * Get live visitors
 * @param {Object} args
 * @param {string} args.startDate
 * @param {string} args.endDate
 * @param {string} args.range
 * @param {Object} args.filters
 * @param          args.args
 * @return {Promise<*>}
 */
export const getDevicesSubtitleData = async({
	startDate,
	endDate,
	range,
	args
}) => {
	const { data } = await getData(
		'devicesSubtitle',
		startDate,
		endDate,
		range,
		args
	);
	return transformDevicesSubtitle( data );
};
