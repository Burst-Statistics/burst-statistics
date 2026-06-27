<?php
namespace Burst\UserAgentParser;

require_once BURST_PATH . 'lib/vendor/autoload.php';

use donatj\UserAgent\Browsers;
use donatj\UserAgent\UserAgentParser as OriginalParser;

class UserAgentParser {

	private OriginalParser $parser;

	/**
	 * Cached list of known/valid browser names from the donatj library.
	 *
	 * @var string[]|null
	 */
	private static ?array $known_browsers = null;

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
	 * Uses an allowlist: the donatj `Browsers` interface is generated from the
	 * parser itself and lists every browser name the parser can legitimately
	 * emit. Anything outside that set is fallback garbage - the parser returns
	 * the leading token of an unrecognized user agent as the "browser"
	 * (e.g. "amazon-Quick-on-behalf-of-03b1f1a7" or a random "4yyh9sv5bej"),
	 * which a denylist can never reliably catch.
	 *
	 * @param string $browser Browser name to validate.
	 * @return bool True if invalid, false if valid.
	 */
	public function is_invalid_browser_name( string $browser ): bool {
		if ( $browser === '' ) {
			return true;
		}

		if ( self::$known_browsers === null ) {
			$reflection           = new \ReflectionClass( Browsers::class );
			self::$known_browsers = array_values( $reflection->getConstants() );
		}

		return ! in_array( $browser, self::$known_browsers, true );
	}
}
