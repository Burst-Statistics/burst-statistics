import { __, sprintf } from '@wordpress/i18n';

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
	exclusion_allowed?: boolean;
	multi_select?: boolean;

	/** When set, shows a time-limited "New" badge. */
	new_badge?: { version: string; days: number; tooltip?: string };

	/** Singular/plural noun used in the collapsed multi-value chip count badge, e.g. "page" / "pages". */
	countNoun?: { singular: string; plural: string };
}

/**
 * Filter configuration with labels, icons, and categories.
 */
export const FILTER_CONFIG: Record<string, FilterConfig> = {

	// Free Filters.
	page_url: {
		label: __( 'Page', 'burst-statistics' ),
		icon: 'page',
		type: 'string',
		options: 'pages',
		pro: false,
		category: 'content',
		reloadOnSearch: true,
		exclusion_allowed: true,
		multi_select: true,
		countNoun: { singular: __( 'page', 'burst-statistics' ), plural: __( 'pages', 'burst-statistics' ) }
	},
	referrer: {
		label: __( 'Referrer', 'burst-statistics' ),
		icon: 'referrer',
		type: 'string',
		options: 'referrers',
		pro: false,
		category: 'sources',
		reloadOnSearch: true,
		exclusion_allowed: true,
		multi_select: true,
		countNoun: { singular: __( 'referrer', 'burst-statistics' ), plural: __( 'referrers', 'burst-statistics' ) }
	},
	goal_id: {
		label: __( 'Goal', 'burst-statistics' ),
		icon: 'goals',
		type: 'string',
		options: 'goals',
		pro: false,
		category: 'content',
		exclusion_allowed: true,
		multi_select: true,
		countNoun: { singular: __( 'goal', 'burst-statistics' ), plural: __( 'goals', 'burst-statistics' ) }
	},
	bounces: {
		label: __( 'Bounce', 'burst-statistics' ),
		icon: 'bounce',
		type: 'boolean',
		pro: false,
		category: 'behavior',
		exclusion_allowed: false
	},
	status: {
		label: __( 'Status', 'burst-statistics' ),
		icon: 'page',
		type: 'boolean',
		pro: false,
		category: 'content',
		exclusion_allowed: true
	},
	device_id: {
		label: __( 'Device', 'burst-statistics' ),
		icon: 'desktop',
		type: 'string',
		options: 'devices',
		pro: false,
		category: 'content',
		exclusion_allowed: false,
		multi_select: true,
		countNoun: { singular: __( 'device', 'burst-statistics' ), plural: __( 'devices', 'burst-statistics' ) }
	},

	// Pro Filters.
	host: {
		label: __( 'Domain', 'burst-statistics' ),
		icon: 'browser',
		type: 'string',
		options: 'hosts',
		pro: true,
		category: 'sources',
		multi_select: true,
		countNoun: { singular: __( 'domain', 'burst-statistics' ), plural: __( 'domains', 'burst-statistics' ) }
	},
	new_visitor: {
		label: __( 'Visitor type', 'burst-statistics' ),
		icon: 'user',
		type: 'boolean',
		pro: true,
		category: 'behavior',
		exclusion_allowed: false
	},
	entry_exit_pages: {
		label: __( 'Page type', 'burst-statistics' ),
		icon: 'bounce',
		type: 'boolean',
		pro: true,
		category: 'behavior',
		exclusion_allowed: false
	},
	parameter: {
		label: __( 'URL parameter', 'burst-statistics' ),
		icon: 'parameters',
		type: 'string',
		pro: true,
		category: 'sources',
		exclusion_allowed: true
	},
	utm_campaign: {
		label: __( 'UTM campaign', 'burst-statistics' ),
		icon: 'campaign',
		type: 'string',
		options: 'campaigns',
		pro: true,
		category: 'sources',
		exclusion_allowed: true,
		multi_select: true,
		countNoun: { singular: __( 'campaign', 'burst-statistics' ), plural: __( 'campaigns', 'burst-statistics' ) }
	},
	utm_source: {
		label: __( 'UTM source', 'burst-statistics' ),
		icon: 'source',
		type: 'string',
		options: 'sources',
		pro: true,
		category: 'sources',
		exclusion_allowed: true
	},
	utm_medium: {
		label: __( 'UTM medium', 'burst-statistics' ),
		icon: 'medium',
		type: 'string',
		options: 'mediums',
		pro: true,
		category: 'sources',
		exclusion_allowed: true
	},
	utm_term: {
		label: __( 'UTM term', 'burst-statistics' ),
		icon: 'term',
		type: 'string',
		options: 'terms',
		pro: true,
		category: 'sources',
		exclusion_allowed: true
	},
	utm_content: {
		label: __( 'UTM content', 'burst-statistics' ),
		icon: 'content',
		type: 'string',
		options: 'contents',
		pro: true,
		category: 'sources',
		exclusion_allowed: true
	},
	source: {
		label: __( 'Source', 'burst-statistics' ),
		icon: 'source',
		type: 'string',
		options: 'traffic_sources',
		pro: true,
		category: 'sources',
		exclusion_allowed: true
	},
	source_category: {
		label: __( 'Source Category', 'burst-statistics' ),
		icon: 'source',
		type: 'string',
		options: 'source_categories',
		pro: true,
		category: 'sources',
		exclusion_allowed: true,
		multi_select: true,
		countNoun: { singular: __( 'source', 'burst-statistics' ), plural: __( 'sources', 'burst-statistics' ) }
	},
	medium: {
		label: __( 'Medium', 'burst-statistics' ),
		icon: 'medium',
		type: 'string',
		pro: true,
		category: 'sources',
		exclusion_allowed: true,
		multi_select: true,
		countNoun: { singular: __( 'content value', 'burst-statistics' ), plural: __( 'content values', 'burst-statistics' ) }
	},
	country_code: {
		label: __( 'Country', 'burst-statistics' ),
		icon: 'world',
		type: 'string',
		options: 'countries',
		pro: true,
		category: 'location',
		exclusion_allowed: true,
		multi_select: true,
		countNoun: { singular: __( 'country', 'burst-statistics' ), plural: __( 'countries', 'burst-statistics' ) }
	},
	state: {
		label: __( 'State', 'burst-statistics' ),
		icon: 'map-pinned',
		type: 'string',
		options: 'states',
		pro: true,
		category: 'location',
		exclusion_allowed: true,
		multi_select: true,
		countNoun: { singular: __( 'state', 'burst-statistics' ), plural: __( 'states', 'burst-statistics' ) }
	},
	city: {
		label: __( 'City', 'burst-statistics' ),
		icon: 'city',
		type: 'string',
		options: 'cities',
		pro: true,
		category: 'location',
		exclusion_allowed: true,
		multi_select: true,
		countNoun: { singular: __( 'city', 'burst-statistics' ), plural: __( 'cities', 'burst-statistics' ) }
	},
	continent_code: {
		label: __( 'Continent', 'burst-statistics' ),
		icon: 'continent',
		type: 'string',
		options: 'continents',
		pro: true,
		category: 'location',
		exclusion_allowed: true,
		multi_select: true,
		countNoun: { singular: __( 'continent', 'burst-statistics' ), plural: __( 'continents', 'burst-statistics' ) }
	},
	time_per_session: {
		label: __( 'Time per session', 'burst-statistics' ),
		icon: 'time',
		type: 'int',
		pro: true,
		category: 'behavior',
		new_badge: { version: '3.2.3', days: 30, tooltip: __( 'New in 3.2.3 – filter visitors by how long they spent on your site.', 'burst-statistics' ) }
	},
	platform_id: {
		label: __( 'Operating system', 'burst-statistics' ),
		icon: 'operating-system',
		type: 'string',
		options: 'platforms',
		pro: true,
		category: 'content',
		exclusion_allowed: true,
		multi_select: true,
		countNoun: { singular: __( 'operating system', 'burst-statistics' ), plural: __( 'operating systems', 'burst-statistics' ) }
	},
	browser_id: {
		label: __( 'Browser', 'burst-statistics' ),
		icon: 'browser',
		type: 'string',
		options: 'browsers',
		pro: true,
		category: 'content',
		exclusion_allowed: true,
		multi_select: true,
		countNoun: { singular: __( 'browser', 'burst-statistics' ), plural: __( 'browsers', 'burst-statistics' ) }
	}
};

// Get all filter keys from config.
export const FILTER_KEYS = Object.keys( FILTER_CONFIG ) as FilterKey[];

// Type for filter keys.
export type FilterKey = keyof typeof FILTER_CONFIG;

// Trailing parameter key to prevent URL parsing issues with hash fragments.
export const TRAILING_PARAM_KEY = '_';

/**
 * Filter search params type - each filter key maps to an optional string.
 * Exclusion is encoded as a '!' prefix on the value (e.g. '!google.com').
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
): FilterSearchParams & { burst_share_token?: string } => {
	const filters: FilterSearchParams & { burst_share_token?: string } = {};

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

	// Preserve the share token across client-side navigations so the backend
	// can identify shared viewers on every page-load and API request.
	if ( 'string' === typeof search.burst_share_token && '' !== search.burst_share_token ) {
		filters.burst_share_token = search.burst_share_token;
	}

	return filters;
};

/**
 * Checks if a filter value indicates exclusion (starts with '!').
 *
 * @param value - The filter value to check.
 *
 * @return True if the value indicates exclusion, false otherwise.
 */
export const isExcluding = ( value: string | undefined ): boolean => {
	return !! value && value.startsWith( '!' );
};

/**
 * Splits a comma-separated filter value into a trimmed, non-empty array of raw values.
 * Assumes any leading exclusion '!' has already been stripped by the caller.
 *
 * @param value - The (already unprefixed) filter value, e.g. '/a,/b'.
 *
 * @return Array of individual raw values.
 */
export const splitFilterValues = ( value: string | undefined ): string[] => {
	if ( ! value ) {
		return [];
	}
	return value.split( ',' ).map( ( v ) => v.trim() ).filter( Boolean );
};

/**
 * The four explicit operators a filter chip can render.
 */
export type FilterOperator = 'is' | 'is-not' | 'is-any-of' | 'is-not-any-of';

/**
 * Human-readable, translatable labels for each filter operator.
 */
export const FILTER_OPERATOR_LABELS: Record<FilterOperator, string> = {
	is: __( 'is', 'burst-statistics' ),
	'is-not': __( 'is not', 'burst-statistics' ),
	'is-any-of': __( 'is any of', 'burst-statistics' ),
	'is-not-any-of': __( 'is not one of', 'burst-statistics' )
};

/**
 * Derives the explicit operator for a filter based on whether it excludes and
 * whether it currently has more than one selected value.
 *
 * @param options            - Operator inputs.
 * @param options.isExcluded  - Whether the filter is in exclude mode.
 * @param options.isMultiValue - Whether the filter currently has 2+ values.
 *
 * @return The matching filter operator.
 */
export const getFilterOperator = ({ isExcluded, isMultiValue }: { isExcluded: boolean; isMultiValue: boolean }): FilterOperator => {
	if ( isExcluded ) {
		return isMultiValue ? 'is-not-any-of' : 'is-not';
	}
	return isMultiValue ? 'is-any-of' : 'is';
};

/**
 * Builds the translatable "( N noun )" count label shown on a collapsed
 * multi-value filter chip, e.g. "( 13 pages )". Falls back to a generic
 * "value" / "values" noun when the filter has no configured countNoun.
 *
 * @param config - The filter's configuration (for its countNoun), or null.
 * @param count  - The number of selected values.
 *
 * @return The formatted count label.
 */
// fallow-ignore-next-line complexity
export const buildCountLabel = ( config: FilterConfig | null | undefined, count: number ): string => {
	const singular = config?.countNoun?.singular || __( 'value', 'burst-statistics' );
	const plural = config?.countNoun?.plural || __( 'values', 'burst-statistics' );
	const noun = 1 === count ? singular : plural;

	return sprintf( '%1$d %2$s', count, noun );
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

