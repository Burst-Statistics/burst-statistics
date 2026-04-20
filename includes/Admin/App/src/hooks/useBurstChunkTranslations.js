import { useEffect } from '@wordpress/element';
import { setLocaleData } from '@wordpress/i18n';

/**
 * Loads chunk translations from `burst_settings.json_translations` into `@wordpress/i18n`.
 * Only applies when translations are present (production build), not in typical dev mode.
 */
export default function useBurstChunkTranslations() {
	useEffect( () => {
		burst_settings.json_translations.forEach( ( translationsString ) => {
			const translations = JSON.parse( translationsString );
			const localeData =
				translations.locale_data['burst-statistics'] ||
				translations.locale_data.messages;
			localeData[''].domain = 'burst-statistics';
			setLocaleData( localeData, 'burst-statistics' );
		});
	}, []);
}
