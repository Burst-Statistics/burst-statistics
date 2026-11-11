import { __ } from '@wordpress/i18n';

/**
 * Step numbers of the goal wizard.
 */
export const GOAL_STEP = {
	START: 1,
	TARGET: 2,
	COUNT: 3,
	REVIEW: 4
} as const;

export type GoalKind = 'clicks' | 'views' | 'visits' | 'hook' | 'download' | 'event';

export interface GoalEventFilter {
	key: string;
	op: 'equals' | 'in';
	value: string | string[];
}

export interface GoalLike {
	type: string;
	selector?: string;
	hook?: string;
	specific_page?: string;
	page_or_website?: string;
	event_filter?: string | GoalEventFilter | null;
}

/**
 * A goal as returned by the goals/get endpoint.
 */
export interface Goal extends GoalLike {
	id: number;
	title: string;
	status: 'active' | 'inactive';
	conversion_metric: string;
	selector: string;
	hook: string;
	specific_page: string;
	page_or_website: string;
	date_created: number;
	event_filter?: string | GoalEventFilter | null;

	// The goal's page is a draft, so its url is not final yet.
	is_draft?: boolean;
}

/**
 * What kind of conversion the goal is: clicks, views, visits, hook, download, or custom event.
 *
 * @param {GoalLike} goal The goal.
 * @return {GoalKind} The kind of goal.
 */
export const getGoalKind = ( goal: GoalLike ): GoalKind => {
	if ( 'event' === goal.type ) {
		return 'file_download' === goal.hook ? 'download' : 'event';
	}
	return ( goal.type as GoalKind ) || 'clicks';
};

/**
 * Whether a goal type tracks an element on the page: clicks and views do, visits and hooks do not.
 *
 * @param {string} type The goal type.
 * @return {boolean} True for click and view goals.
 */
export const isElementType = ( type: string ): boolean => 'clicks' === type || 'views' === type;

/**
 * The wizard steps a goal type goes through: only click and view goals choose where they count.
 *
 * @param {string} type The goal type.
 * @return {number[]} The step numbers, in order.
 */
export const getGoalSteps = ( type: string ): number[] =>
	isElementType( type ) ?
		[ GOAL_STEP.START, GOAL_STEP.TARGET, GOAL_STEP.COUNT, GOAL_STEP.REVIEW ] :
		[ GOAL_STEP.START, GOAL_STEP.TARGET, GOAL_STEP.REVIEW ];

/**
 * The page a goal is set up on.
 *
 * Click and view goals without a page use the home page: the page field shows
 * '/' for them and the server saves an empty page as '/'.
 *
 * @param {GoalLike} goal The goal.
 * @return {string} The page path, or '' when none is chosen.
 */
export const getGoalPage = ( goal: GoalLike ): string => {
	if ( goal.specific_page ) {
		return goal.specific_page;
	}
	return isElementType( goal.type ) ? '/' : '';
};

/**
 * Whether the browser accepts a CSS selector. The tracking script skips a goal
 * whose selector it cannot parse, so such a goal never counts.
 *
 * @param {string} selector The CSS selector.
 * @return {boolean} True when the selector parses.
 */
const isValidSelector = ( selector: string ): boolean => {
	try {
		document.createDocumentFragment().querySelector( selector );
		return true;
	} catch {
		return false;
	}
};

/**
 * Parse an event filter into its object representation.
 *
 * @param {string | GoalEventFilter | null | undefined} filter Filter value.
 * @return {GoalEventFilter | null} The parsed filter or null.
 */
// fallow-ignore-next-line complexity
export const parseEventFilter = ( filter: string | GoalEventFilter | null | undefined ): GoalEventFilter | null => {
	if ( ! filter ) {
		return null;
	}
	if ( 'object' === typeof filter ) {
		return filter;
	}
	try {
		const parsed = JSON.parse( filter );
		return 'object' === typeof parsed && null !== parsed ? parsed : null;
	} catch {
		return null;
	}
};

/**
 * Format a list of file extensions uppercase separated by comma.
 *
 * @param {string[]} extensions Extension list.
 * @return {string} Formatted uppercase string.
 */
export const formatExtensionsList = ( extensions: string[]): string => {
	return extensions.map( ( ext: string ) => ext.toUpperCase() ).join( ', ' );
};

/**
 * Whether an event goal has a valid event name and, if an event filter is set, a valid filter.
 *
 * @param {GoalLike} goal The event goal.
 * @return {boolean} True when the event goal is complete.
 */
// fallow-ignore-next-line complexity
const hasEventTarget = ( goal: GoalLike ): boolean => {
	if ( ! goal.hook?.trim() ) {
		return false;
	}
	if ( goal.event_filter ) {
		const filter = parseEventFilter( goal.event_filter );
		if ( ! filter || ! filter.key?.trim() ) {
			return false;
		}
		if ( 'equals' === filter.op ) {
			return 'string' === typeof filter.value && !! filter.value.trim();
		}
		if ( 'in' === filter.op ) {
			return Array.isArray( filter.value ) && 0 < filter.value.length;
		}
		return false;
	}
	return true;
};

/**
 * Whether a hook goal names its hook, and its page when it counts on one page.
 *
 * @param {GoalLike} goal The hook goal.
 * @return {boolean} True when the hook goal is set up.
 */
const hasHookTarget = ( goal: GoalLike ): boolean =>
	!! goal.hook?.trim() && ( 'page' !== goal.page_or_website || !! getGoalPage( goal ) );

/**
 * Whether a click or view goal has a selector the browser accepts.
 *
 * @param {GoalLike} goal The click or view goal.
 * @return {boolean} True when the selector is set and valid.
 */
const hasValidSelector = ( goal: GoalLike ): boolean =>
	!! goal.selector?.trim() && isValidSelector( goal.selector );

/**
 * Whether a goal has everything it needs to count conversions.
 *
 * Shared by the goals table, the wizard and the dashboard notices so an
 * unfinished goal is flagged the same way everywhere.
 *
 * @param {GoalLike} goal The goal to check.
 * @return {boolean} True when the goal can be activated.
 */
export const isGoalComplete = ( goal: GoalLike ): boolean => {
	if ( 'event' === goal.type ) {
		return hasEventTarget( goal );
	}

	if ( 'hook' === goal.type ) {
		return hasHookTarget( goal );
	}

	if ( 'visits' === goal.type ) {
		return !! getGoalPage( goal );
	}

	return hasValidSelector( goal );
};

export interface GoalTrackingBlocker {
	type: 'custom_events_off' | 'downloads_off';
	label: string;
	noticeText: string;
	wizardHeaderStatus: string;
}

/**
 * Check if tracking is turned off for this complete goal.
 *
 * @param {GoalLike} goal The goal to check.
 * @return {GoalTrackingBlocker | null} The blocker if tracking is off, or null.
 */
// fallow-ignore-next-line complexity
export const getGoalTrackingBlocker = ( goal: GoalLike ): GoalTrackingBlocker | null => {
	if ( ! isGoalComplete( goal ) ) {
		return null;
	}

	if ( 'event' !== goal.type ) {
		return null;
	}

	const fields = window.burst_settings?.fields;
	const customEventsField = Array.isArray( fields ) ? fields.find( ( f: { id: string }) => 'enable_custom_events' === f.id ) : null;
	const customEventsEnabled = customEventsField ? !! customEventsField.value : !! window.burst_settings?.custom_events_enabled;

	if ( ! customEventsEnabled ) {
		return {
			type: 'custom_events_off',
			label: __( 'Custom events are off', 'burst-statistics' ),
			noticeText: __( 'Custom event tracking is off, so this goal cannot count conversions yet.', 'burst-statistics' ),
			wizardHeaderStatus: __( 'Not tracking, custom events are off', 'burst-statistics' )
		};
	}

	const kind = getGoalKind( goal );
	if ( 'download' === kind ) {
		const downloadsField = Array.isArray( fields ) ? fields.find( ( f: { id: string }) => 'track_downloads' === f.id ) : null;
		const downloadsEnabled = downloadsField ? !! downloadsField.value : !! window.burst_settings?.track_downloads;
		if ( ! downloadsEnabled ) {
			return {
				type: 'downloads_off',
				label: __( 'Download tracking is off', 'burst-statistics' ),
				noticeText: __( 'Download tracking is off, so this goal cannot count conversions yet.', 'burst-statistics' ),
				wizardHeaderStatus: __( 'Not tracking, download tracking is off', 'burst-statistics' )
			};
		}
	}

	return null;
};

/**
 * Whether a goal is counting conversions right now: switched on, finished, and tracking is not blocked.
 *
 * @param {GoalLike & {status: string}} goal The goal.
 * @return {boolean} True when the goal counts conversions.
 */
export const isGoalCounting = ( goal: GoalLike & { status: string }): boolean =>
	'active' === goal.status && isGoalComplete( goal ) && ! getGoalTrackingBlocker( goal );

/**
 * The wizard step to open an existing goal on: setup if unfinished or tracking blocked, otherwise review.
 *
 * @param {GoalLike} goal The goal to open.
 * @return {number} The wizard step.
 */
export const getGoalResumeStep = ( goal: GoalLike ): number =>
	isGoalComplete( goal ) && ! getGoalTrackingBlocker( goal ) ? GOAL_STEP.REVIEW : GOAL_STEP.TARGET;

// Classes WordPress and themes generate for layout or state; they say nothing about what the element is.
const GENERATED_CLASS = /^(wp-|has-|is-)/;

/**
 * The part of a selector that names the tracked element: the last compound of
 * its first selector, without attribute and pseudo-class parts.
 *
 * @param {string} selector The goal's CSS selector.
 * @return {string} The compound, e.g. "a.buy-now#cta".
 */
const getTargetCompound = ( selector: string ): string => {
	const first = selector.split( ',' )[0].trim();
	const parts = first.split( /\s*[>+~]\s*|\s+/ ).filter( Boolean );
	return ( parts[ parts.length - 1 ] ?? '' ).replace( /\[[^\]]*\]/g, '' ).replace( /:[\w-]+(\([^)]*\))?/g, '' );
};

/**
 * The readable name a compound selector carries: its id, else its first class that WordPress did not generate.
 *
 * @param {string} compound A compound selector, e.g. "a.buy-now".
 * @return {string} Lowercase name in words, e.g. "buy now", or '' when there is none.
 */
const getReadableName = ( compound: string ): string => {
	const id = compound.match( /#([\w-]+)/ )?.[1];
	const className = Array.from( compound.matchAll( /\.([\w-]+)/g ), ( m ) => m[1])
		.find( ( name ) => ! GENERATED_CLASS.test( name ) );
	return ( id ?? className ?? '' ).replace( /[-_]+/g, ' ' ).trim().toLowerCase();
};

/**
 * Turn a CSS selector into words a site owner recognises: the kind of element
 * and, when the selector carries a readable id or class, its name.
 *
 * Only the element the selector ends on is described; ancestors only narrow it down.
 *
 * @param {string} selector The goal's CSS selector.
 * @return {{tag: string, name: string}} Lowercase tag name and readable name, each '' when unknown.
 */
export const describeSelector = ( selector: string ): { tag: string; name: string } => {
	const compound = getTargetCompound( selector );
	return {
		tag: ( compound.match( /^[a-zA-Z][a-zA-Z0-9-]*/ )?.[0] ?? '' ).toLowerCase(),
		name: getReadableName( compound )
	};
};

/**
 * A short form of a selector to name the element by: its most specific own class or its id.
 *
 * Classes WordPress generates are shared by many elements, so they never stand in for the selector.
 *
 * @param {string} selector The goal's CSS selector.
 * @return {string} E.g. ".get-pro" for "a.wp-block-button__link.get-pro", or the selector itself when it has neither.
 */
export const getShortSelector = ( selector: string ): string => {
	const compound = getTargetCompound( selector );
	const className = Array.from( compound.matchAll( /\.([\w-]+)/g ), ( m ) => m[1])
		.filter( ( name ) => ! GENERATED_CLASS.test( name ) )
		.pop();
	if ( className ) {
		return '.' + className;
	}

	const id = compound.match( /#([\w-]+)/ )?.[1];
	return id ? '#' + id : selector;
};

/**
 * Whether a goal may be switched on: it must be finished, and a paused goal needs room under the active goal limit.
 *
 * @param {GoalLike & {status: string}} goal           The goal.
 * @param {boolean}                     isLimitReached Whether the active goal limit is reached.
 * @return {boolean} True when the goal can be active.
 */
export const canActivateGoal = ( goal: GoalLike & { status: string }, isLimitReached: boolean ): boolean =>
	isGoalComplete( goal ) && ( 'active' === goal.status || ! isLimitReached );
