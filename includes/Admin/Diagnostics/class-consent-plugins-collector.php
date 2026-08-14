<?php
/**
 * Consent / cookie-banner diagnostic collector.
 *
 * @package Burst\Admin\Diagnostics
 */

namespace Burst\Admin\Diagnostics;

use Burst\Admin\Tasks;

defined( 'ABSPATH' ) || exit;

/**
 * Class Consent_Plugins_Collector
 *
 * Detects cookie-banner / consent plugins and the WP Consent API. These can
 * legitimately withhold the tracking script until the visitor consents, so an
 * active one is a plausible explanation for a drop in recorded hits.
 */
class Consent_Plugins_Collector extends Diagnostic_Collector {

	/**
	 * Plugin basename => display name for known consent plugins.
	 *
	 * @var array<string, string>
	 */
	private const CONSENT_PLUGINS = [
		'complianz-gdpr/complianz-gpdr.php'   => 'Complianz',
		'complianz-gdpr-premium/complianz-gpdr-premium.php' => 'Complianz Premium',
		'cookie-law-info/cookie-law-info.php' => 'CookieYes',
		'cookiebot/cookiebot.php'             => 'Cookiebot',
		'borlabs-cookie/borlabs-cookie.php'   => 'Borlabs Cookie',
		'real-cookie-banner/index.php'        => 'Real Cookie Banner',
		'wpconsent-cookies-banner-privacy-suite/wpconsent.php' => 'WP Consent Cookie Banner Privacy Suite',
	];

	/**
	 * {@inheritDoc}
	 */
	public function key(): string {
		return 'consent_plugins';
	}

	/**
	 * {@inheritDoc}
	 */
	public function collect(): array {
		$label              = __( 'Cookie banner / consent plugins', 'burst-statistics' );
		$active             = $this->active_plugins();
		$consent_api_active = Tasks::is_wp_consent_api_active();

		$found = [];
		foreach ( self::CONSENT_PLUGINS as $file => $name ) {
			if ( in_array( $file, $active, true ) ) {
				$found[] = $name;
			}
		}

		if ( empty( $found ) && ! $consent_api_active ) {
			return $this->result(
				'ok',
				$label,
				__( 'No cookie banner or consent plugin that could withhold the tracking script was detected.', 'burst-statistics' )
			);
		}

		return $this->result(
			'warning',
			$label,
			__( 'A consent plugin is active and may legitimately withhold tracking until the visitor consents.', 'burst-statistics' ),
			[
				'active_plugins'     => $found,
				'consent_api_active' => $consent_api_active,
			]
		);
	}
}
