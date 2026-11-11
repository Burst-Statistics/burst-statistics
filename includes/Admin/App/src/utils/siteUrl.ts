declare const burst_settings: {
	rest_url: string;
	admin_ajax_url: string;
};

/**
 * Get the site's REST or admin-ajax url.
 *
 * If the site is loaded over https, but the site url is not https, force to
 * use https anyway, because otherwise we get mixed content issues.
 *
 * @param type Pass any value for the admin-ajax url instead of the REST url.
 * @return The url.
 */
export const siteUrl = ( type?: string ): string => {
	const url = 'undefined' === typeof type ? burst_settings.rest_url : burst_settings.admin_ajax_url;

	if ( 'https:' === window.location.protocol && -1 === url.indexOf( 'https://' ) ) {
		return url.replace( 'http://', 'https://' );
	}

	return url;
};
