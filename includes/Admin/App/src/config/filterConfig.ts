import { __ } from '@wordpress/i18n';

/**
 * Filter categories configuration.
 */
export const FILTER_CATEGORIES = {
	content: {
		label: __( 'Context', 'burst-statistics' ),
		icon: 'content',
		order: 1
	},
	sources: {
		label: __( 'Sources', 'burst-statistics' ),
		icon: 'source',
		order: 2
	},
	behavior: {
		label: __( 'Behavior', 'burst-statistics' ),
		icon: 'behavior',
		order: 3
	},
	location: {
		label: __( 'Location', 'burst-statistics' ),
		icon: 'location',
		order: 4
	}
} as const;

export type FilterCategory = keyof typeof FILTER_CATEGORIES;

/**
 * Filter configuration interface.
 */
export interface FilterConfig {
	label: string;
	icon: string;
	type: 'string' | 'boolean' | 'int';
	options?: string;
	pro: boolean;
	category: FilterCategory;
	reloadOnSearch?: boolean;
	coming_soon?: boolean;
}

/**
 * Filter configuration with labels, icons, and categories.
 */
export const FILTER_CONFIG: Record<string, FilterConfig> = {

	// Free Filters.
	page_url: {
		label: __( 'Page URL', 'burst-statistics' ),
		icon: 'page',
		type: 'string',
		options: 'pages',
		pro: false,
		category: 'content',
		reloadOnSearch: true
	},
	referrer: {
		label: __( 'Referrer', 'burst-statistics' ),
		icon: 'referrer',
		type: 'string',
		options: 'referrers',
		pro: false,
		category: 'sources',
		reloadOnSearch: true
	},
	goal_id: {
		label: __( 'Goal', 'burst-statistics' ),
		icon: 'goals',
		type: 'string',
		options: 'goals',
		pro: false,
		category: 'content'
	},
	bounces: {
		label: __( 'Bounced Visitors', 'burst-statistics' ),
		icon: 'bounce',
		type: 'boolean',
		pro: false,
		category: 'behavior'
	},
	device_id: {
		label: __( 'Device', 'burst-statistics' ),
		icon: 'desktop',
		type: 'string',
		options: 'devices',
		pro: false,
		category: 'content'
	},

	// Pro Filters.
	host: {
		label: __( 'Domain', 'burst-statistics' ),
		icon: 'browser',
		type: 'string',
		options: 'hosts',
		pro: true,
		category: 'sources'
	},
	new_visitor: {
		label: __( 'New Visitors', 'burst-statistics' ),
		icon: 'user',
		type: 'boolean',
		pro: true,
		category: 'behavior'
	},
	bounce_rate: {
		label: __( 'Bounce Rate', 'burst-statistics' ),
		icon: 'bounce',
		type: 'int',
		pro: true,
		category: 'behavior',
		coming_soon: true
	},
	entry_exit_pages: {
		label: __( 'Entry or exit page', 'burst-statistics' ),
		icon: 'bounce',
		type: 'boolean',
		pro: true,
		category: 'behavior'
	},
	conversion_rate: {
		label: __( 'Conversion Rate', 'burst-statistics' ),
		icon: 'conversion',
		type: 'int',
		pro: true,
		category: 'behavior',
		coming_soon: true
	},
	parameter: {
		label: __( 'URL Parameter', 'burst-statistics' ),
		icon: 'parameters',
		type: 'string',
		pro: true,
		category: 'sources'
	},
	parameters: {
		label: __( 'URL Parameters', 'burst-statistics' ),
		icon: 'parameters',
		type: 'string',
		pro: true,
		category: 'sources'
	},
	campaign: {
		label: __( 'Campaign', 'burst-statistics' ),
		icon: 'campaign',
		type: 'string',
		options: 'campaigns',
		pro: true,
		category: 'sources'
	},
	source: {
		label: __( 'Source', 'burst-statistics' ),
		icon: 'source',
		type: 'string',
		options: 'contents',
		pro: true,
		category: 'sources'
	},
	medium: {
		label: __( 'Medium', 'burst-statistics' ),
		icon: 'medium',
		type: 'string',
		options: 'mediums',
		pro: true,
		category: 'sources'
	},
	term: {
		label: __( 'Term', 'burst-statistics' ),
		icon: 'term',
		type: 'string',
		options: 'terms',
		pro: true,
		category: 'sources'
	},
	content: {
		label: __( 'Content', 'burst-statistics' ),
		icon: 'content',
		type: 'string',
		options: 'contents',
		pro: true,
		category: 'sources'
	},
	country_code: {
		label: __( 'Country', 'burst-statistics' ),
		icon: 'world',
		type: 'string',
		options: 'countries',
		pro: true,
		category: 'location'
	},
	state: {
		label: __( 'State', 'burst-statistics' ),
		icon: 'map-pinned',
		type: 'string',
		options: 'states',
		pro: true,
		category: 'location'
	},
	city: {
		label: __( 'City', 'burst-statistics' ),
		icon: 'city',
		type: 'string',
		options: 'cities',
		pro: true,
		category: 'location'
	},
	continent_code: {
		label: __( 'Continent', 'burst-statistics' ),
		icon: 'continent',
		type: 'string',
		options: 'continents',
		pro: true,
		category: 'location'
	},
	time_per_session: {
		label: __( 'Time per Session', 'burst-statistics' ),
		icon: 'time',
		type: 'int',
		pro: true,
		category: 'behavior',
		coming_soon: true
	},
	platform_id: {
		label: __( 'Operating System', 'burst-statistics' ),
		icon: 'operating-system',
		type: 'string',
		options: 'platforms',
		pro: true,
		category: 'content'
	},
	browser_id: {
		label: __( 'Browser', 'burst-statistics' ),
		icon: 'browser',
		type: 'string',
		options: 'browsers',
		pro: true,
		category: 'content'
	}
};

// Get all filter keys from config.
export const FILTER_KEYS = Object.keys( FILTER_CONFIG ) as FilterKey[];

// Type for filter keys.
export type FilterKey = keyof typeof FILTER_CONFIG;

// Trailing parameter key to prevent URL parsing issues with hash fragments.
export const TRAILING_PARAM_KEY = '_';

/**
 * Filter search params type - all filters are optional strings.
 * Includes trailing param for URL parsing safety.
 */
export type FilterSearchParams = {
	[K in FilterKey]?: string;
} & {
	[TRAILING_PARAM_KEY]?: string;
};

/**
 * Validates and parses search params for filters.
 * Used by TanStack Router's validateSearch.
 *
 * @param search - The raw search params from the URL.
 * @return Validated filter search params.
 */
export const validateFilterSearch = (
	search: Record<string, unknown>
): FilterSearchParams => {
	const filters: FilterSearchParams = {};

	FILTER_KEYS.forEach( ( key ) => {
		const value = search[key];
		if ( 'string' === typeof value && '' !== value ) {
			filters[key] = value;
		}
	});

	// Preserve trailing param for URL parsing safety.
	if ( TRAILING_PARAM_KEY in search ) {
		filters[TRAILING_PARAM_KEY] = '';
	}

	return filters;
};

/**
 * Initial filter state - all filters empty.
 */
export const INITIAL_FILTERS: FilterSearchParams = FILTER_KEYS.reduce(
	( acc, key ) => {
		acc[key] = '';
		return acc;
	},
	{} as FilterSearchParams
);

// Default favorites for new users.
export const DEFAULT_FAVORITES = [ 'page_url', 'referrer', 'bounces', 'device_id' ];

