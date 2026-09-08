<?php
namespace Burst\Admin\Search_Console;

defined( 'ABSPATH' ) || die();

/**
 * Stores Google Search Console connection and synchronization state.
 */
class State_Store {

	/**
	 * Consolidated Search Console state option.
	 */
	private const OPTION = 'burst_gsc_state';

	/**
	 * Return the resolved Search Console property.
	 */
	public function property(): string {
		return (string) ( $this->get()['property'] ?? '' );
	}

	/**
	 * Whether Search Console property resolution completed.
	 */
	public function property_checked(): bool {
		return (bool) ( $this->get()['property_checked'] ?? false );
	}

	/**
	 * Return whether the selected property exactly matches the configured site.
	 * Null means the scope predates explicit scope storage and must be derived.
	 */
	public function property_exact(): ?bool {
		$state = $this->get();
		return array_key_exists( 'property_exact', $state ) ? (bool) $state['property_exact'] : null;
	}

	/**
	 * Whether an explicit property status has been stored.
	 */
	public function has_property_status(): bool {
		return array_key_exists( 'property_status', $this->get() );
	}

	/**
	 * Current property state with a compatibility fallback for older state.
	 */
	public function property_status(): string {
		$state  = $this->get();
		$status = (string) ( $state['property_status'] ?? '' );
		if ( in_array( $status, [ 'matched', 'none', 'paused' ], true ) ) {
			return $status;
		}
		if ( empty( $state['property_checked'] ) ) {
			return 'pending';
		}
		return '' === (string) ( $state['property'] ?? '' ) ? 'none' : 'matched';
	}

	/**
	 * Timestamp after which property resolution may be retried.
	 */
	public function property_retry_at(): int {
		return (int) ( $this->get()['property_retry_at'] ?? 0 );
	}

	/**
	 * Store a completed property resolution.
	 */
	public function set_property( string $property, bool $clear_sync = false, ?bool $exact = null ): void {
		$this->update(
			static function ( array $state ) use ( $property, $clear_sync, $exact ): array {
				$state['property']         = $property;
				$state['property_checked'] = true;
				$state['property_status']  = '' === $property ? 'none' : 'matched';
				if ( null !== $exact ) {
					$state['property_exact'] = $exact;
				}
				unset( $state['property_retry_at'] );
				if ( $clear_sync ) {
					$state['sync'] = [];
				}
				return $state;
			}
		);
	}

	/**
	 * Store an unavailable property state while retaining its last identity.
	 *
	 * @param 'none'|'paused' $status Property status.
	 * @throws \InvalidArgumentException When the property status is unsupported.
	 */
	public function set_property_unavailable( string $status, int $retry_at ): void {
		if ( ! in_array( $status, [ 'none', 'paused' ], true ) ) {
			throw new \InvalidArgumentException( 'Unsupported Search Console property status.' );
		}

		$this->update(
			static function ( array $state ) use ( $status, $retry_at ): array {
				$state['property_checked']  = true;
				$state['property_status']   = $status;
				$state['property_retry_at'] = $retry_at;
				return $state;
			}
		);
	}

	/**
	 * Force property resolution to run again while retaining the last property.
	 */
	public function clear_property_checked(): void {
		$this->update(
			static function ( array $state ): array {
				unset( $state['property_checked'], $state['property_status'], $state['property_retry_at'] );
				return $state;
			}
		);
	}

	/**
	 * Return the site URL associated with the stored data, or null when unset.
	 */
	public function site_url(): ?string {
		$state = $this->get();
		return array_key_exists( 'site_url', $state ) ? (string) $state['site_url'] : null;
	}

	/**
	 * Store the current site URL, optionally clearing property and sync state.
	 */
	public function set_site_url( string $site_url, bool $clear_state = false ): void {
		$this->update(
			static function ( array $state ) use ( $site_url, $clear_state ): array {
				$state['site_url'] = $site_url;
				if ( $clear_state ) {
					unset(
						$state['property'],
						$state['property_checked'],
						$state['property_exact'],
						$state['property_status'],
						$state['property_retry_at']
					);
					$state['sync'] = [];
				}
				return $state;
			}
		);
	}

	/**
	 * Return the site-wide query data version.
	 */
	public function data_version(): int {
		return (int) ( $this->get()['site_terms_data_version'] ?? 0 );
	}

	/**
	 * Reset site-wide synchronization state for a new data version.
	 */
	public function reset_sync_for_data_version( int $version ): void {
		$this->update(
			static function ( array $state ) use ( $version ): array {
				$state['sync']                    = [];
				$state['site_terms_data_version'] = $version;
				return $state;
			}
		);
	}

	/**
	 * Return site-wide synchronization state.
	 */
	public function sync(): array {
		$sync = $this->get()['sync'] ?? [];
		return is_array( $sync ) ? $sync : [];
	}

	/**
	 * Store site-wide synchronization state.
	 */
	public function set_sync( array $sync ): void {
		$this->update(
			static function ( array $state ) use ( $sync ): array {
				$state['sync'] = $sync;
				return $state;
			}
		);
	}

	/**
	 * Return the diagnostic context content version.
	 */
	public function diagnostic_logs_content_version(): string {
		return (string) ( $this->get()['diagnostic_logs_content_version'] ?? '' );
	}

	/**
	 * Store the diagnostic context content version.
	 */
	public function set_diagnostic_logs_content_version( string $version ): void {
		$this->update(
			static function ( array $state ) use ( $version ): array {
				$state['diagnostic_logs_content_version'] = $version;
				return $state;
			}
		);
	}

	/**
	 * Migrate legacy Search Console state and remove obsolete options.
	 */
	public static function migrate_legacy_options(): bool {
		$missing      = new \stdClass();
		$current      = get_option( self::OPTION, $missing );
		$state_exists = $missing !== $current;
		$state        = is_array( $current ) ? $current : [];

		$legacy_options = [
			'burst_gsc_site_url'                        => 'site_url',
			'burst_gsc_property'                        => 'property',
			'burst_gsc_property_checked'                => 'property_checked',
			'burst_gsc_property_exact'                  => 'property_exact',
			'burst_gsc_property_status'                 => 'property_status',
			'burst_gsc_property_retry_at'               => 'property_retry_at',
			'burst_gsc_site_terms_data_version'         => 'site_terms_data_version',
			'burst_gsc_sync_state'                      => 'sync',
			'burst_gsc_diagnostic_logs_content_version' => 'diagnostic_logs_content_version',
		];

		$changed = $state_exists && ! is_array( $current );
		if ( array_key_exists( 'backfill_scope', $state ) ) {
			unset( $state['backfill_scope'] );
			$changed = true;
		}
		foreach ( $legacy_options as $option => $key ) {
			$value = get_option( $option, $missing );
			if ( $missing === $value || array_key_exists( $key, $state ) ) {
				continue;
			}

			$state[ $key ] = match ( $key ) {
				'property_checked', 'property_exact'           => (bool) $value,
				'property_retry_at', 'site_terms_data_version' => (int) $value,
				'sync'                                         => is_array( $value ) ? $value : [],
				default                                        => (string) $value,
			};
			$changed = true;
		}

		if ( $changed ) {
			update_option( self::OPTION, $state, false );
			$state_exists = true;
		}

		if ( $state_exists && get_option( self::OPTION, $missing ) !== $state ) {
			return false;
		}

		$options_to_delete = array_merge( array_keys( $legacy_options ), [ 'burst_gsc_backfill_scope' ] );
		foreach ( $options_to_delete as $option ) {
			delete_option( $option );
			if ( $missing !== get_option( $option, $missing ) ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Read the consolidated state.
	 */
	private function get(): array {
		$state = get_option( self::OPTION, [] );
		return is_array( $state ) ? $state : [];
	}

	/**
	 * Apply a state change to the latest stored value.
	 *
	 * @param callable $callback State mutation callback.
	 */
	private function update( callable $callback ): void {
		update_option( self::OPTION, $callback( $this->get() ), false );
	}
}
