import { __, sprintf } from '@wordpress/i18n';
import { GOAL_STEP, describeSelector, getGoalPage, isGoalComplete } from './goalHelpers';
import type { Goal, GoalLike } from './goalHelpers';

/**
 * The kind of element, by tag name, as a site owner would call it.
 *
 * @param {string} tag Lowercase tag name, '' when the selector has none.
 * @return {string} The element noun.
 */
const getElementNoun = ( tag: string ): string => {
	if ( /^h[1-6]$/.test( tag ) ) {
		return __( 'Heading', 'burst-statistics' );
	}

	const nouns: Record<string, string> = {
		a: __( 'Link', 'burst-statistics' ),
		button: __( 'Button', 'burst-statistics' ),
		input: __( 'Form field', 'burst-statistics' ),
		img: __( 'Image', 'burst-statistics' ),
		form: __( 'Form', 'burst-statistics' ),
		p: __( 'Paragraph', 'burst-statistics' ),
		li: __( 'List item', 'burst-statistics' ),
		video: __( 'Video', 'burst-statistics' ),
		nav: __( 'Menu', 'burst-statistics' )
	};
	return nouns[ tag ] ?? __( 'Element', 'burst-statistics' );
};

/**
 * What a click or view goal tracks when its element has a readable name.
 *
 * @param {string} type The goal type.
 * @param {string} name Readable element name, e.g. newsletter signup.
 * @return {string} The description.
 */
const getNamedElementText = ( type: string, name: string ): string => {
	return 'views' === type ?

		/* translators: %s: readable element name, e.g. newsletter signup. */
		sprintf( __( 'Views of “%s”', 'burst-statistics' ), name ) :

		/* translators: %s: readable element name, e.g. newsletter signup. */
		sprintf( __( 'Clicks on “%s”', 'burst-statistics' ), name );
};

/**
 * What a click or view goal tracks when only the kind of element is known.
 *
 * @param {string} type The goal type.
 * @param {string} tag  Lowercase tag name, '' when the selector has none.
 * @return {string} The description.
 */
const getElementKindText = ( type: string, tag: string ): string => {
	return 'views' === type ?

		/* translators: %s: kind of element, e.g. Link or Button. */
		sprintf( __( '%s views', 'burst-statistics' ), getElementNoun( tag ) ) :

		/* translators: %s: kind of element, e.g. Link or Button. */
		sprintf( __( '%s clicks', 'burst-statistics' ), getElementNoun( tag ) );
};

/**
 * What a click or view goal tracks, in words instead of its CSS selector.
 *
 * @param {Goal} goal The goal.
 * @return {string} The description, empty when no element is chosen.
 */
const getElementTracksText = ( goal: Goal ): string => {
	if ( ! goal.selector ) {
		return '';
	}

	const { tag, name } = describeSelector( goal.selector );
	return name ? getNamedElementText( goal.type, name ) : getElementKindText( goal.type, tag );
};

/**
 * What a hook goal tracks.
 *
 * @param {Goal} goal The goal.
 * @return {string} The description, empty when no hook is entered.
 */
const getHookTracksText = ( goal: Goal ): string => {

	/* translators: %s: WordPress hook name, e.g. woocommerce_add_to_cart. */
	return goal.hook ? sprintf( __( 'When %s runs', 'burst-statistics' ), goal.hook ) : '';
};

/**
 * What a visit goal tracks.
 *
 * @param {Goal} goal The goal.
 * @return {string} The description, empty when no page is chosen.
 */
const getVisitTracksText = ( goal: Goal ): string => {
	const page = getGoalPage( goal );

	/* translators: %s: page path, e.g. /thank-you/. */
	return page ? sprintf( __( 'Visits to %s', 'burst-statistics' ), page ) : '';
};

const TRACKS_TEXT: Record<string, ( goal: Goal ) => string> = {
	hook: getHookTracksText,
	visits: getVisitTracksText
};

/**
 * What a goal tracks, in words instead of a CSS selector or raw setting.
 *
 * @param {Goal} goal The goal.
 * @return {string} The description, empty when the goal is not set up yet.
 */
export const getTracksText = ( goal: Goal ): string =>
	( TRACKS_TEXT[ goal.type ] ?? getElementTracksText )( goal );

/**
 * Where a goal counts: its page, or the whole site.
 *
 * @param {GoalLike} goal The goal.
 * @return {string} The page path or "Whole site", empty when the goal needs a page that is not chosen.
 */
export const getCountsOnText = ( goal: GoalLike ): string =>
	'visits' === goal.type || 'page' === goal.page_or_website ?
		getGoalPage( goal ) :
		__( 'Whole site', 'burst-statistics' );

/**
 * Where a click or view goal counts, as the wizard's review shows it.
 *
 * @param {GoalLike} goal The goal.
 * @return {string} "Every page where it appears" or "Only on /pricing".
 */
export const getWhereText = ( goal: GoalLike ): string =>
	'page' === goal.page_or_website ?

		/* translators: %s: page path, e.g. /pricing. */
		sprintf( __( 'Only on %s', 'burst-statistics' ), getGoalPage( goal ) ) :
		__( 'Every page where it appears', 'burst-statistics' );

/**
 * Label of the button that saves a goal and keeps it counting. A goal that is
 * already active, e.g. a preset, which is added active, is saved, not started.
 *
 * @param {Goal} goal The goal being saved.
 * @return {string} The button label.
 */
export const getFinishLabel = ( goal: Goal ): string =>
	'active' === goal.status ?
		__( 'Save changes', 'burst-statistics' ) :
		__( 'Save and start tracking', 'burst-statistics' );

/**
 * What an unfinished goal still needs, so the user knows why they cannot continue.
 *
 * @param {Goal} goal The unfinished goal.
 * @return {string} The missing piece.
 */
const getMissingTargetHint = ( goal: Goal ): string => {
	if ( 'hook' === goal.type ) {
		return goal.hook.trim() ?
			__( 'Choose a page to continue.', 'burst-statistics' ) :
			__( 'Enter the hook to track to continue.', 'burst-statistics' );
	}
	if ( 'visits' === goal.type ) {
		return __( 'Choose a page to continue.', 'burst-statistics' );
	}
	return goal.selector.trim() ?
		__( 'Fix the CSS selector to continue.', 'burst-statistics' ) :
		__( 'Choose the element to track to continue.', 'burst-statistics' );
};

/**
 * Why the wizard cannot continue from this step, if it cannot.
 *
 * Only the setup steps need a finished goal; the first step creates it and review shows what is missing.
 *
 * @param {Goal | null} goal The goal being set up, null before it exists.
 * @param {number}      step The current wizard step.
 * @return {string} The missing piece, empty when the user can continue.
 */
export const getBlockingHint = ( goal: Goal | null, step: number ): string => {
	const isSetupStep = GOAL_STEP.TARGET === step || GOAL_STEP.COUNT === step;
	if ( ! isSetupStep || ! goal || isGoalComplete( goal ) ) {
		return '';
	}
	return getMissingTargetHint( goal );
};
