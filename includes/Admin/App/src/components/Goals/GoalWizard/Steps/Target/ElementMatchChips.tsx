import { __, _n, sprintf } from '@wordpress/i18n';
import { clsx } from 'clsx';
import Icon from '@/utils/Icon';

// How the match chip looks when the element is found, and when it is not.
const FOUND_TONE = { classes: 'border-green-300 bg-green-50 text-green-700', icon: 'check', color: 'green' };
const MISSING_TONE = { classes: 'border-yellow-300 bg-yellow-50 text-text-black', icon: 'warning', color: 'yellow' };

/**
 * How many elements the selector matches on its page, as a short chip text.
 *
 * @param {number|null} matchCount How many elements match, null while unknown.
 * @return {string} The chip text, empty while unknown.
 */
const getMatchText = ( matchCount: number | null ): string => {
	if ( null === matchCount ) {
		return '';
	}
	if ( 0 === matchCount ) {
		return __( 'Not found on that page', 'burst-statistics' );
	}

	/* translators: %d: number of elements the selector matches. */
	return sprintf( _n( '%d match on that page', '%d matches on that page', matchCount, 'burst-statistics' ), matchCount );
};

/**
 * The page chip: where the element was found, or only checked when nothing matched there.
 *
 * @param {string}      page       The page path.
 * @param {number|null} matchCount How many elements match, null while unknown.
 * @return {string} The chip text.
 */
const getPageText = ( page: string, matchCount: number | null ): string =>
	0 === matchCount ?

		/* translators: %s: page path, e.g. /pricing/. */
		sprintf( __( 'Checked on %s', 'burst-statistics' ), page ) :

		/* translators: %s: page path, e.g. /pricing/. */
		sprintf( __( 'Found on %s', 'burst-statistics' ), page );

interface ElementMatchChipsProps {

	// Page the selector is checked on, e.g. '/pricing/'.
	page: string;

	// How many elements match, null while unknown.
	matchCount: number | null;
}

/**
 * Where the selector was checked and how many elements it matches there.
 *
 * @param {ElementMatchChipsProps} props            Component props.
 * @param {string}                 props.page       The page the selector is checked on.
 * @param {number|null}            props.matchCount How many elements match.
 * @return {JSX.Element} The chips.
 */
const ElementMatchChips = ({ page, matchCount }: ElementMatchChipsProps ): JSX.Element => {
	const matchText = getMatchText( matchCount );
	const tone = 0 < ( matchCount ?? 0 ) ? FOUND_TONE : MISSING_TONE;

	return (
		<div className="flex flex-wrap gap-2">
			<span className="flex items-center gap-1.5 rounded-full border border-gray-300 px-3 py-1 text-sm text-text-gray">
				<Icon name="page" size={14} color="gray" />
				{getPageText( page, matchCount )}
			</span>
			{matchText && (
				<span className={clsx( 'flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm', tone.classes )}>
					<Icon name={tone.icon} size={14} color={tone.color} />
					{matchText}
				</span>
			)}
		</div>
	);
};

export default ElementMatchChips;
