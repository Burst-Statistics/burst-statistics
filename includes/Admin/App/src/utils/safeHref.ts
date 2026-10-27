/** URL schemes that are safe to open from a link in the admin. */
const SAFE_PROTOCOLS = [ 'http:', 'https:' ];

/**
 * Origin of the current page, or undefined outside a browser (unit tests).
 *
 * @return The page origin, if there is one.
 */
const currentOrigin = (): string | undefined =>
	'undefined' !== typeof window ? window.location.origin : undefined;

/**
 * Parses a URL without throwing.
 *
 * @param url  - URL to parse.
 * @param base - Base to resolve a relative URL against.
 * @return The parsed URL, or null when it can't be parsed.
 */
const parseUrl = ( url: string, base: string | undefined ): URL | null => {
	try {
		return new URL( url, base );
	} catch {
		return null;
	}
};

/**
 * Returns a normalized href for a URL, but only when it uses http or https.
 *
 * Statistics data such as outgoing links and visitor flow nodes ends up in an
 * anchor's href. A `javascript:` or `data:` URL there would run in the admin,
 * so anything that is not plain http(s) is rejected here instead of relying on
 * how the server stored it.
 *
 * @param url  - URL to check; relative paths resolve against `base`.
 * @param base - Origin to resolve relative paths against. Defaults to the current page's origin.
 * @return The normalized absolute href, or undefined when the URL is empty, invalid or uses another scheme.
 */
export const safeHref = (
	url: string | undefined | null,
	base: string | undefined = currentOrigin()
): string | undefined => {
	const parsed = url?.trim() ? parseUrl( url.trim(), base ) : null;

	return parsed && SAFE_PROTOCOLS.includes( parsed.protocol ) ? parsed.href : undefined;
};
