import { __, sprintf } from '@wordpress/i18n';

/**
 * Helpers for lists of email addresses: report recipients and alert email
 * recipients. Kept free of React so the rules can be unit tested.
 */

/** Maximum number of addresses, the same for reports and alerts (Alert_Preferences::MAX_RECIPIENTS). */
export const MAX_EMAIL_RECIPIENTS = 100;

/**
 * Whether a string looks like an email address.
 *
 * @param {string} email Address to check.
 * @return {boolean} True for a plausible address.
 */
const isValidEmail = ( email: string ): boolean => {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test( email.trim() );
};

/** Settings for validateEmailList(). */
export interface EmailListRules {
	requiredMessage?: string;
	isRequired?: boolean;
	max?: number;
}

/**
 * Validate a list of email addresses.
 *
 * @param {unknown}        value Current field value.
 * @param {EmailListRules} rules When the list is required and its maximum size.
 * @return {true|string} True when valid, otherwise the error message.
 */
// fallow-ignore-next-line complexity -- One early return per rule, in the order the user should fix them.
export const validateEmailList = ( value: unknown, rules: EmailListRules = {}): true | string => {
	const emails = Array.isArray( value ) ? ( value as string[]) : [];
	const max = rules.max ?? MAX_EMAIL_RECIPIENTS;

	if ( rules.isRequired && 0 === emails.length ) {
		return rules.requiredMessage || __( 'Add at least one address.', 'burst-statistics' );
	}

	if ( emails.length > max ) {
		return sprintf(

			// translators: %d is the maximum number of email addresses.
			__( 'Maximum %d recipients allowed', 'burst-statistics' ),
			max
		);
	}

	if ( ! emails.every( isValidEmail ) ) {
		return __( 'One or more email addresses are invalid', 'burst-statistics' );
	}

	const unique = new Set( emails.map( ( email ) => email.trim().toLowerCase() ) );
	if ( unique.size !== emails.length ) {
		return __( 'Duplicate email addresses are not allowed', 'burst-statistics' );
	}

	return true;
};
