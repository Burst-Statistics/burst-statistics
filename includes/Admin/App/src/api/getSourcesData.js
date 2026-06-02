import { getData } from '@/utils/api';

const CATEGORY_DATA = [
	{ id: 'search', label: 'Search', value: 46 },
	{ id: 'social', label: 'Social', value: 24 },
	{ id: 'direct', label: 'Direct', value: 18 },
	{ id: 'ai', label: 'AI', value: 7 },
	{ id: 'campaigns', label: 'Campaigns', value: 3 },
	{ id: 'other', label: 'Other', value: 2 }
];

const DRILLDOWN_DATA = {
	search: [
		{ source: 'Google', visits: 1228, percentage: 58 },
		{ source: 'Bing', visits: 423, percentage: 20 },
		{ source: 'DuckDuckGo', visits: 275, percentage: 13 },
		{ source: 'Yahoo', visits: 190, percentage: 9 }
	],
	social: [
		{ source: 'Facebook', visits: 532, percentage: 42 },
		{ source: 'X', visits: 322, percentage: 26 },
		{ source: 'LinkedIn', visits: 233, percentage: 18 },
		{ source: 'Instagram', visits: 179, percentage: 14 }
	],
	direct: [
		{ source: 'Direct', visits: 802, percentage: 78 }
	],
	ai: [
		{ source: 'ChatGPT', visits: 121, percentage: 54 },
		{ source: 'Perplexity', visits: 66, percentage: 29 },
		{ source: 'Claude', visits: 37, percentage: 17 }
	],
	campaigns: [
		{ source: 'Newsletter April', visits: 39, percentage: 51 },
		{ source: 'Spring Promo', visits: 24, percentage: 31 },
		{ source: 'Partner Campaign', visits: 14, percentage: 18 }
	],
	other: [
		{ source: 'Campaigns', visits: 100, percentage: 10 },
		{ source: 'Referral', visits: 100, percentage: 10 },
		{ source: 'Other', visits: 100, percentage: 10 }
	]
};

const TOP_SOURCES_DATA = [
	{ id: 'google', source: 'Google', percentage: 34.2 },
	{ id: 'facebook', source: 'Facebook', percentage: 14.8 },
	{ id: 'direct', source: 'Direct', percentage: 22.3 },
	{ id: 'bing', source: 'Bing', percentage: 11.8 },
	{ id: 'chatgpt', source: 'ChatGPT', percentage: 3.4 }
];

/**
 * Get traffic source category totals.
 *
 * @param {Object} args            - Request arguments.
 * @param {string} args.startDate  - Start date.
 * @param {string} args.endDate    - End date.
 * @param {string} args.range      - Date range key.
 * @param {Object} args.args       - Additional filters.
 * @return {Promise<Array>} Category rows for the donut chart.
 */
export const getSourcesCategoryData = async({ startDate, endDate, range, args }) => {

	// TODO: Replace with real API call once backend categorisation is complete.
	// await getData( 'sources/categories', startDate, endDate, range, args );
	void getData;
	void startDate;
	void endDate;
	void range;
	void args;
	return CATEGORY_DATA;
};

/**
 * Get source breakdown for a category.
 *
 * @param {Object} args            - Request arguments.
 * @param {string} args.startDate  - Start date.
 * @param {string} args.endDate    - End date.
 * @param {string} args.range      - Date range key.
 * @param {Object} args.args       - Additional filters.
 * @param {string} args.category   - Selected traffic category.
 * @return {Promise<Array>} Source rows for drill-down display.
 */
export const getSourcesDrilldownData = async({
	startDate,
	endDate,
	range,
	args,
	category
}) => {

	// TODO: Replace with real API call once backend categorisation is complete.
	// await getData( 'sources/drilldown', startDate, endDate, range, { ...args, category } );
	void getData;
	void startDate;
	void endDate;
	void range;
	void args;
	return DRILLDOWN_DATA[category] ?? [];
};

/**
 * Get top traffic sources across all categories.
 *
 * @param {Object} args            - Request arguments.
 * @param {string} args.startDate  - Start date.
 * @param {string} args.endDate    - End date.
 * @param {string} args.range      - Date range key.
 * @param {Object} args.args       - Additional filters.
 * @return {Promise<Array>} Top source rows.
 */
export const getTopSourcesData = async({ startDate, endDate, range, args }) => {

	// TODO: Replace with real API call once backend categorisation is complete.
	// await getData( 'sources/top', startDate, endDate, range, args );
	void getData;
	void startDate;
	void endDate;
	void range;
	void args;
	return TOP_SOURCES_DATA;
};
