import { getData } from '@/utils/api';
import { __ } from '@wordpress/i18n';

export const DISTRIBUTION_COLORS = {
	gateways: [
		'var(--color-primary-700)',
		'var(--color-primary-600)',
		'var(--color-primary-400)',
		'var(--color-primary-300)',
		'var(--color-primary-200)'
	],
	currencies: [
		'var(--color-blue-800)',
		'var(--color-blue-600)',
		'var(--color-blue-400)',
		'var(--color-blue-200)',
		'var(--color-blue-100)'
	],
	countries: [
		'var(--color-orange-700)',
		'var(--color-orange-600)',
		'var(--color-orange-400)',
		'var(--color-orange-300)',
		'var(--color-orange-200)'
	]
};

/**
 * Structural placeholder for the pie chart skeleton.
 * Four equal slices so the donut shape is visible during loading
 * without implying any real distribution.
 */
export const DISTRIBUTION_PLACEHOLDER_DATA = [
	{ id: 'loading-0', label: '-', value: 25 },
	{ id: 'loading-1', label: '-', value: 25 },
	{ id: 'loading-2', label: '-', value: 25 },
	{ id: 'loading-3', label: '-', value: 25 }
];

/** Muted gray palette used in place of real colors while data is loading. */
export const DISTRIBUTION_LOADING_COLORS = [
	'var(--color-gray-300)',
	'var(--color-gray-400)',
	'var(--color-gray-500)',
	'var(--color-gray-600)'
];

/**
 * Fetches distribution data for subscriptions.
 * Gateways, currencies, and countries are loaded on demand from the API.
 *
 * @param {string} view Selected distribution view.
 * @param {Object} args Request arguments.
 * @param {string} args.startDate Start date.
 * @param {string} args.endDate End date.
 * @param {string} args.range Selected range key.
 * @param {Object} args.filters Active filters.
 * @return {Promise<Array>} The resolved distribution data array.
 */
export async function fetchDistributionData( view, { startDate, endDate, range, filters }) {
	const { data } = await getData(
		'ecommerce/subscriptions-distribution',
		startDate,
		endDate,
		range,
		{ filters, distribution_view: view }
	);

	if ( ! Array.isArray( data ) ) {
		return [];
	}

	// Normalize incoming data and ensure numeric raw values.
	const normalized = data
		.filter( ( item ) => item && 'object' === typeof item )
		.map( ( item ) => {
			const label = item.label ?? item.id ?? '-';
			const raw = Number( item.value ?? 0 );

			return {
				id: String( item.id ?? label ),
				label: String( label ),
				raw
			};
		})
		.filter( ( item ) => Number.isFinite( item.raw ) && 0 < item.raw );

	if ( 0 === normalized.length ) {
		return [];
	}

	// Compute total raw value and per-item percentage.
	const total = normalized.reduce( ( acc, cur ) => acc + cur.raw, 0 );

	if ( 0 === total ) {
		return [];
	}

	const itemsWithPercent = normalized.map( ( item ) => ({
		...item,
		percent: ( item.raw / total ) * 100
	}) );

	const thresholdPercent = 2;
	const smallItems = itemsWithPercent.filter( ( item ) => item.percent < thresholdPercent );
	const largeItems = itemsWithPercent.filter( ( item ) => item.percent >= thresholdPercent );
	const othersPercent = smallItems.reduce( ( acc, item ) => acc + item.percent, 0 );

	const output = largeItems.map( ( item ) => ({
		id: String( item.id ),
		label: String( item.label ),
		value: Number( item.percent.toFixed( 2 ) )
	}) );

	if ( 0 < smallItems.length ) {
		output.push({
			id: 'others',
			label: __( 'Others', 'burst-statistics' ),
			value: Number( othersPercent.toFixed( 2 ) ),
			items: smallItems.map( ( item ) => ({
				id: item.id,
				label: item.label,
				percent: Number( item.percent.toFixed( 2 ) )
			}) )
		});
	}

	return output;
}
