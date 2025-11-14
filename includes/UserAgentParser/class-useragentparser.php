<?php
namespace Burst\UserAgentParser;

require_once BURST_PATH . 'lib/vendor/autoload.php';

use donatj\UserAgent\Browsers;
use donatj\UserAgent\UserAgentParser as OriginalParser;

class UserAgentParser {

	private OriginalParser $parser;

	/**
	 * Constructor
	 */
	public function __construct() {
		$this->parser = new OriginalParser();
	}

	/**
	 * Get user agent data
	 *
	 * @param string $user_agent The User Agent.
	 * @return null[]|string[]
	 */
	public function get_user_agent_data( string $user_agent ): array {
		$defaults = [
			'browser'         => '',
			'browser_version' => '',
			'platform'        => '',
			'device'          => '',
		];
		if ( $user_agent === '' ) {
			return $defaults;
		}

		$ua_object = $this->parser->parse( $user_agent );
		$ua        = [
			'browser'  => $ua_object->browser() ?? '',
			'version'  => $ua_object->browserVersion() ?? '',
			'platform' => $ua_object->platform() ?? '',
		];

		// Filter out suspicious/invalid browser names.
		if ( $this->is_invalid_browser_name( $ua['browser'] ) ) {
			// Return empty defaults for invalid browsers.
			return $defaults;
		}

		switch ( $ua['platform'] ) {
			case 'Macintosh':
			case 'Chrome OS':
			case 'Linux':
			case 'Windows':
				$ua['device'] = 'desktop';
				break;
			case 'Android':
			case 'BlackBerry':
			case 'iPhone':
			case 'Windows Phone':
			case 'Sailfish':
			case 'Symbian':
			case 'Tizen':
				$ua['device'] = 'mobile';
				break;
			case 'iPad':
				$ua['device'] = 'tablet';
				break;
			case 'PlayStation 3':
			case 'PlayStation 4':
			case 'PlayStation 5':
			case 'PlayStation Vita':
			case 'Xbox':
			case 'Xbox One':
			case 'New Nintendo 3DS':
			case 'Nintendo 3DS':
			case 'Nintendo DS':
			case 'Nintendo Switch':
			case 'Nintendo Wii':
			case 'Nintendo WiiU':
			case 'iPod':
			case 'Kindle':
			case 'Kindle Fire':
			case 'NetBSD':
			case 'OpenBSD':
			case 'PlayBook':
			case 'FreeBSD':
			default:
				$ua['device'] = 'other';
				break;
		}

		// change version to browser_version.
		$ua['browser_version'] = $ua['version'];
		unset( $ua['version'] );

		return wp_parse_args( $ua, $defaults );
	}

	/**
	 * Check if browser name is invalid/suspicious.
	 *
	 * @param string $browser Browser name to validate.
	 * @return bool True if invalid, false if valid.
	 */
	public function is_invalid_browser_name( string $browser ): bool {
		if ( empty( $browser ) ) {
			return true;
		}

		// Get all known browser constants from the library.
		$reflection     = new \ReflectionClass( Browsers::class );
		$known_browsers = array_values( $reflection->getConstants() );
		if ( in_array( $browser, $known_browsers, true ) ) {
			return false;
		}

		// Too short (single letter browsers don't exist).
		if ( strlen( $browser ) <= 2 ) {
			return true;
		}

		// Common test/spam values.
		$spam_patterns = [
			'test',
			'random',
			'bot',
			'crawler',
			'spider',
			'script',
			'curl',
			'wget',
			'python',
			'java',
			'http',
			'https',
			'www',
			'admin',
			'root',
			'null',
			'python-requests',
			'SOSSE',
		];

		$browser_lower = strtolower( $browser );
		foreach ( $spam_patterns as $pattern ) {
			if ( $browser_lower === $pattern ) {
				return true;
			}
		}

		// Only contains numbers or special characters.
		if ( preg_match( '/^[0-9\W]+$/', $browser ) ) {
			return true;
		}

		return false;
	}
}
