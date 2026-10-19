import { __, sprintf } from '@wordpress/i18n';
import type { ReactNode } from 'react';
import type { GreenHostingState } from './usePageWeightData';

/** The Green Web Foundation's own privacy statement for the lookup. */
export const PRIVACY_STATEMENT_URL = 'https://www.thegreenwebfoundation.org/privacy-statement/';

/**
 * Whether a current check result exists for this site.
 *
 * checked_at is cleared once the cached result goes stale, so this reports a
 * usable verification rather than merely a past attempt.
 *
 * @param {GreenHostingState} greenHosting - The green hosting state.
 * @return {boolean} Whether a current result exists.
 */
export const hasCurrentCheck = ( greenHosting: GreenHostingState ): boolean =>
	greenHosting.checked && 0 < greenHosting.status.checked_at;

/**
 * The green hosting result as a single metadata phrase.
 *
 * @param {Object}            props              - Component props.
 * @param {GreenHostingState} props.greenHosting - The green hosting state.
 * @return {ReactNode} The status phrase.
 */
export const GreenHostingStatus = ({
	greenHosting
}: {
	greenHosting: GreenHostingState;
}): ReactNode => {

	// Every phrase names green hosting: on its own, a bare "Not verified" above
	// a button says nothing about what was not verified.
	if ( ! hasCurrentCheck( greenHosting ) ) {
		return <>{ __( 'Green hosting: not checked', 'burst-statistics' ) }</>;
	}

	if ( ! greenHosting.status.green ) {
		return <>{ __( 'Green hosting: not verified', 'burst-statistics' ) }</>;
	}

	// hosted_by names the hosting provider, not the party that verified it, so
	// the sentence says the site is hosted there rather than "verified by" it.
	const provider = greenHosting.status.hosted_by;
	return (
		<span className="font-medium text-green">
			{ '' === provider ?
				__( 'This website uses green hosting', 'burst-statistics' ) :
				sprintf(

					/* translators: %s is the hosting provider's name. */
					__( 'This website uses green hosting from %s', 'burst-statistics' ),
					provider
				) }
		</span>
	);
};

/**
 * The check action. This is the footer's primary action: on a site that has
 * never been checked it is the one thing the reader can usefully do here.
 *
 * @param {Object}   props            - Component props.
 * @param {boolean}  props.hasResult  - Whether a current result already exists.
 * @param {boolean}  props.isChecking - Whether a check is in flight.
 * @param {Function} props.onCheck    - Starts a check.
 * @return {ReactNode} The check button.
 */
export const GreenHostingCheck = ({
	hasResult,
	isChecking,
	onCheck
}: {
	hasResult: boolean;
	isChecking: boolean;
	onCheck: () => void;
}): ReactNode => (
	<button
		type="button"
		className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-text-white shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
		onClick={onCheck}
		disabled={isChecking}
	>
		{ isChecking ?
			__( 'Checking…', 'burst-statistics' ) :
			( hasResult ?
				__( 'Check again', 'burst-statistics' ) :
				__( 'Check', 'burst-statistics' ) ) }
	</button>
);
