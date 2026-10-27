<?php
namespace Burst\Admin;

defined( 'ABSPATH' ) || die( 'you do not have access to this page!' );

/**
 * Non-autoloaded storage for small, low-contention Burst admin options.
 *
 * Each category has its own physical WordPress option. Values are loaded only
 * in backend requests and are cached for the lifetime of the request.
 */
final class Admin_Options {
	private const OPTION_PREFIX = 'burst_admin_options_';

	/**
	 * Loaded category values, keyed by category.
	 *
	 * @var array<string, array<string, mixed>>
	 */
	private static array $options = [];

	/**
	 * Categories loaded during this request.
	 *
	 * @var array<string, bool>
	 */
	private static array $loaded = [];

	/**
	 * Get a value from a category.
	 *
	 * @param string $category      Category name.
	 * @param string $name          Option name.
	 * @param mixed  $default_value Default value.
	 */
	public static function get( string $category, string $name, mixed $default_value = null ): mixed {
		$category = sanitize_key( $category );
		$name     = sanitize_key( $name );

		if ( '' === $category || '' === $name ) {
			return $default_value;
		}

		$options = self::load( $category );
		$value   = array_key_exists( $name, $options ) ? $options[ $name ] : $default_value;
		return apply_filters( "burst_admin_option_{$category}_$name", $value, $name, $category );
	}

	/**
	 * Whether a category holds a value for this option.
	 *
	 * @param string $category Category name.
	 * @param string $name Option name.
	 */
	public static function has( string $category, string $name ): bool {
		$missing = new \stdClass();
		return $missing !== self::get( $category, $name, $missing );
	}

	/**
	 * Update a value in a category.
	 *
	 * @param string $category Category name.
	 * @param string $name Option name.
	 * @param mixed  $value Value to store.
	 */
	public static function update( string $category, string $name, mixed $value ): bool {
		$category = sanitize_key( $category );
		$name     = sanitize_key( $name );
		if ( '' === $category || '' === $name ) {
			return false;
		}

		// Nothing to write when the stored row already holds this value. Checked
		// against the database, not the request cache: that is a snapshot from
		// earlier in this request, and another request may have changed the row
		// since. This keeps unchanged writes on hot paths off the lock.
		$stored = self::read_stored( $category );
		if ( array_key_exists( $name, $stored ) && $stored[ $name ] === $value ) {
			self::remember( $category, $stored );
			return true;
		}

		if ( ! self::acquire_lock( $category ) ) {
			return false;
		}
		try {
			$options          = self::load( $category, true );
			$options[ $name ] = $value;
			return self::persist( $category, $options );
		} finally {
			self::release_lock( $category );
		}
	}

	/**
	 * Merge several values into a category, leaving the keys that are not in
	 * the list untouched.
	 *
	 * @param string               $category Category name.
	 * @param array<string, mixed> $values Values keyed by option name.
	 */
	public static function merge( string $category, array $values ): bool {
		$category = sanitize_key( $category );
		if ( '' === $category || [] === $values ) {
			return false;
		}

		if ( ! self::acquire_lock( $category ) ) {
			return false;
		}
		try {
			$options = self::load( $category, true );
			$merged  = array_merge( $options, $values );
			return $merged === $options || self::persist( $category, $merged );
		} finally {
			self::release_lock( $category );
		}
	}

	/**
	 * Delete a value from a category.
	 *
	 * @param string $category Category name.
	 * @param string $name Option name.
	 */
	public static function delete( string $category, string $name ): bool {
		$category = sanitize_key( $category );
		$name     = sanitize_key( $name );
		if ( '' === $category || '' === $name ) {
			return false;
		}

		// Nothing to delete when the stored row has no such key. Checked against
		// the database for the same reason as in update().
		$stored = self::read_stored( $category );
		if ( ! array_key_exists( $name, $stored ) ) {
			self::remember( $category, $stored );
			return true;
		}

		if ( ! self::acquire_lock( $category ) ) {
			return false;
		}
		try {
			$options = self::load( $category, true );
			if ( ! array_key_exists( $name, $options ) ) {
				return true;
			}
			unset( $options[ $name ] );
			return self::persist( $category, $options );
		} finally {
			self::release_lock( $category );
		}
	}

	/**
	 * Load one category once per request.
	 *
	 * @param string $category Category name.
	 * @param bool   $force Whether to bypass request and WordPress option caches.
	 * @return array<string, mixed>
	 */
	private static function load( string $category, bool $force = false ): array {
		$option_name = self::option_name( $category );

		if ( $force ) {
			unset( self::$loaded[ $category ], self::$options[ $category ] );
			wp_cache_delete( $option_name, 'options' );
		} elseif ( isset( self::$loaded[ $category ] ) ) {
			return self::$options[ $category ];
		}

		$options = get_option( $option_name, [] );
		self::remember( $category, is_array( $options ) ? $options : [] );
		return self::$options[ $category ];
	}

	/**
	 * Read the stored row straight from the database, bypassing the request and
	 * object caches. Used for the no-op check before a write, so it sees what
	 * another request may have written, without evicting the cached row for
	 * other workers as a forced load() would.
	 *
	 * @param string $category Category name.
	 * @return array<string, mixed>
	 */
	private static function read_stored( string $category ): array {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- The cached copy is exactly what may be stale.
		$raw    = $wpdb->get_var( $wpdb->prepare( "SELECT option_value FROM {$wpdb->options} WHERE option_name = %s", self::option_name( $category ) ) );
		$stored = null === $raw ? [] : maybe_unserialize( $raw );
		return is_array( $stored ) ? $stored : [];
	}

	/**
	 * Store a freshly read row in the request cache, so later reads in this
	 * request see the stored state.
	 *
	 * @param string               $category Category name.
	 * @param array<string, mixed> $options Category values.
	 */
	private static function remember( string $category, array $options ): void {
		self::$options[ $category ] = $options;
		self::$loaded[ $category ]  = true;
	}

	/**
	 * Persist a category with autoload disabled.
	 *
	 * @param string               $category Category name.
	 * @param array<string, mixed> $options Category values.
	 */
	private static function persist( string $category, array $options ): bool {
		$option_name = self::option_name( $category );
		$current     = get_option( $option_name, [] );
		if ( ! update_option( $option_name, $options, false ) && ( ! is_array( $current ) || $current !== $options ) ) {
			self::report_failed_write( $category, 'write' );
			return false;
		}
		self::remember( $category, $options );
		return true;
	}

	/**
	 * Acquire the category-specific database mutex. Write paths only, so a
	 * failure is a dropped write and is reported as one.
	 *
	 * @param string $category Category name.
	 */
	private static function acquire_lock( string $category ): bool {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- MySQL advisory lock is the cross-request mutex.
		if ( 1 === (int) $wpdb->get_var( $wpdb->prepare( 'SELECT GET_LOCK( %s, 2 )', self::lock_name( $category ) ) ) ) {
			return true;
		}
		self::report_failed_write( $category, 'lock' );
		return false;
	}

	/**
	 * Report a write that could not be stored, so a dropped value is
	 * observable instead of silent. Listeners must not write an admin option
	 * themselves: a write that keeps failing would fire this again.
	 *
	 * @param string $category Category name.
	 * @param string $reason lock for a mutex that could not be acquired, write for a failed option write.
	 */
	private static function report_failed_write( string $category, string $reason ): void {
		do_action( 'burst_admin_option_write_failed', $category, $reason );
	}

	/** Release the category-specific database mutex. */
	private static function release_lock( string $category ): void {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Releases the matching advisory lock.
		$wpdb->query( $wpdb->prepare( 'SELECT RELEASE_LOCK( %s )', self::lock_name( $category ) ) );
	}

	/** Build a site-specific advisory lock name. */
	private static function lock_name( string $category ): string {
		global $wpdb;
		return 'burst_admin_options_' . substr( hash( 'sha256', $wpdb->prefix . ':' . $category ), 0, 32 );
	}

	/**
	 * Build the physical WordPress option name for a category. Public because
	 * code that reads wp_options directly (the Site Health export) must not
	 * hardcode the prefix.
	 *
	 * @param string $category Category name.
	 */
	public static function option_name( string $category ): string {
		return self::OPTION_PREFIX . sanitize_key( $category );
	}
}
