import { addQueryArgs } from '@wordpress/url';
import { getBurstSetting } from '@/utils/formatting';

/**
 * Build the URL of a frontend page rendered in Burst preview mode.
 *
 * Preview mode is gated server side on the burst_nonce and forces a logged out
 * render, so it is only sent for the visitor view. burst_force_logged_out is
 * always sent: its presence alone excludes the page from tracking.
 * @param {string}  baseUrl   The frontend URL to preview.
 * @param {boolean} loggedOut Whether the page should render as a logged out visitor.
 * @return {string} The preview URL.
 */
export const buildPreviewUrl = ( baseUrl: string, loggedOut: boolean ): string =>
	addQueryArgs( baseUrl, {
		...( loggedOut ? { burst_preview: '1' } : {}),
		burst_force_logged_out: loggedOut ? '1' : '0',
		nonce: getBurstSetting<string>( 'burst_nonce', '' )
	});
