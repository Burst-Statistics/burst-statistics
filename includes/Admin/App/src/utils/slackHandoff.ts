/**
 * Utilities for capturing and parsing Slack OAuth redirect handoff tokens.
 */

let storedSlackHandoff: string | null = null;

/**
 * Decodes a base64url-encoded string into a UTF-8 string safely.
 *
 * @param str Base64url encoded string.
 * @return Decoded UTF-8 string, or null on error.
 */
function base64urlDecode( str: string ): string | null {
	try {
		let base64 = str.replace( /-/g, '+' ).replace( /_/g, '/' );
		while ( 0 !== base64.length % 4 ) {
			base64 += '=';
		}
		const binary = atob( base64 );
		const bytes = new Uint8Array( binary.length );
		for ( let i = 0; i < binary.length; i++ ) {
			bytes[ i ] = binary.charCodeAt( i );
		}
		return new TextDecoder().decode( bytes );
	} catch {
		return null;
	}
}

interface HandoffEnvelope {
	sig: string;
	data: string;
}

/**
 * Safely parses the outer JSON envelope.
 *
 * @param decoded JSON string.
 * @return Envelope object or null.
 */
function decodeEnvelope( decoded: string ): HandoffEnvelope | null {
	try {
		const envelope = JSON.parse( decoded );
		if ( envelope && 'string' === typeof envelope.sig && 'string' === typeof envelope.data ) {
			return envelope;
		}
	} catch {

		// Malformed JSON.
	}
	return null;
}

export interface ParsedSlackHandoff {
	signature: string;
	rawPayload: string;
}

/**
 * Parses an envelope token into signature and raw JSON payload string.
 *
 * @param token Base64url-encoded envelope containing { data, sig }.
 * @return Parsed signature and payload string, or null on failure.
 */
export function parseSlackHandoffToken( token: string ): ParsedSlackHandoff | null {
	const decoded = base64urlDecode( token );
	if ( ! decoded ) {
		return null;
	}

	const envelope = decodeEnvelope( decoded );
	if ( ! envelope ) {
		return null;
	}

	const rawPayload = base64urlDecode( envelope.data );
	if ( ! rawPayload ) {
		return null;
	}

	return {
		signature: envelope.sig,
		rawPayload
	};
}

/**
 * Checks for a #burst_slack_handoff= fragment before the router initializes.
 * If present, keeps the token in memory, strips it from the browser URL by replacing
 * history with #/settings/notifications, and allows the hash router to boot cleanly.
 */
export function captureSlackHandoff(): void {
	if ( 'undefined' === typeof window ) {
		return;
	}

	const hash = window.location.hash ?? '';
	if ( ! hash.startsWith( '#burst_slack_handoff=' ) ) {
		return;
	}

	storedSlackHandoff = hash.substring( '#burst_slack_handoff='.length );
	window.history?.replaceState?.( null, '', '#/settings/notifications' );
}

/**
 * Consumes and returns the in-memory handoff token if one was captured on initial load.
 * Clears the stored value so subsequent calls return null.
 *
 * @return The captured token string or null.
 */
export function consumeSlackHandoff(): string | null {
	if ( ! storedSlackHandoff && 'undefined' !== typeof window ) {
		captureSlackHandoff();
	}
	const token = storedSlackHandoff;
	storedSlackHandoff = null;
	return token;
}
