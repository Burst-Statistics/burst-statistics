<?php
namespace Burst\Admin\Search_Console;

use Burst\Traits\Helper;

defined( 'ABSPATH' ) || die();

/**
 * Daily Google Search Console sync.
 *
 * Hooked to burst_every_hour. While history is backfilled (from the plugin
 * install date, capped at Search Console's ~16-month retention) it runs every
 * hour, a chunk of days per run; once caught up it pulls only the latest missing
 * day, at most once per day. Search Console data lags ~2 days, so a daily pull
 * loses nothing. The dashboard never triggers this; it reads only from
 * burst_search_terms.
 */
class Sync {
	use Helper;

	/**
	 * Resolved Search Console property (siteUrl).
	 */
	private const PROPERTY_OPTION = 'burst_gsc_property';

	/**
	 * Whether the resolved property exactly matches the configured site URL.
	 */
	private const PROPERTY_EXACT_OPTION = 'burst_gsc_property_exact';

	/**
	 * Current property-selection state: matched, none, or paused.
	 */
	private const PROPERTY_STATUS_OPTION = 'burst_gsc_property_status';

	/**
	 * Flags that property resolution has completed at least one API attempt.
	 */
	private const PROPERTY_CHECKED_OPTION = 'burst_gsc_property_checked';

	/**
	 * Timestamp after which an unresolved property may be looked up again.
	 */
	private const PROPERTY_RETRY_OPTION = 'burst_gsc_property_retry_at';

	/**
	 * The site URL the stored data was last fetched for. When it changes (e.g.
	 * BURST_GSC_SITE_URL is set or edited), the data is cleared and re-fetched.
	 */
	private const SITE_URL_OPTION = 'burst_gsc_site_url';

	/**
	 * Sync state: { newest, cursor, backfill_done, last_synced, last_run }.
	 */
	private const STATE_OPTION = 'burst_gsc_sync_state';

	/**
	 * Marks that this site has backfilled the full retained Search Console window.
	 */
	private const BACKFILL_SCOPE_OPTION = 'burst_gsc_backfill_scope';

	/**
	 * Increment when the historical backfill scope changes.
	 */
	private const BACKFILL_SCOPE = 'retained_history_v1';

	/**
	 * Search Console data is delayed ~2 days, so this is the most recent day worth requesting.
	 */
	private const LAG_DAYS = 2;

	/**
	 * Hard cap on how far back to backfill: Search Console retains ~16 months, so
	 * older days are pointless to query.
	 */
	private const MAX_BACKFILL_DAYS = 480;

	/**
	 * Days fetched per hourly run while backfilling.
	 */
	private const BACKFILL_CHUNK = 10;

	/**
	 * Avoid repeated property-list requests while property use is paused or unmatched.
	 */
	private const PROPERTY_RETRY_INTERVAL = DAY_IN_SECONDS;

	/**
	 * Token store instance.
	 */
	private Token_Store $token_store;

	/**
	 * Search Console API client.
	 */
	private Client $client;

	/**
	 * Search-term repository.
	 */
	private Search_Terms_Store $store;

	/**
	 * Persistent, redacted diagnostic event store.
	 */
	private Diagnostic_Logs $logs;

	/**
	 * Constructor.
	 */
	public function __construct() {
		$this->token_store = new Token_Store();
		$this->client      = new Client( $this->token_store );
		$this->store       = new Search_Terms_Store();
		$this->logs        = new Diagnostic_Logs();
	}

	/**
	 * Register the table and the hourly sync.
	 */
	public function init(): void {
		add_filter( 'burst_all_tables', [ $this, 'register_table' ] );
		add_action( 'burst_install_tables', [ $this->store, 'install_table' ] );
		add_action( 'burst_every_hour', [ $this, 'maybe_sync' ] );

		// Resolve the property as soon as the connection completes, then kick a
		// near-immediate first sync off the OAuth popup's critical path.
		add_action( 'burst_gsc_connected', [ $this, 'resolve_on_connect' ] );
		add_action( 'burst_gsc_first_sync', [ $this, 'maybe_sync' ] );

		// Expose the stored terms as the read-only `search_console` datatable.
		add_filter( 'burst_datatable_config', [ $this, 'register_datatable_config' ] );
		add_filter( 'burst_datatable_id_tab_map', [ $this, 'register_datatable_tab' ] );
		add_filter( 'burst_datatable_pre_data', [ $this, 'datatable_pre_data' ], 10, 2 );
	}

	/**
	 * Return stored diagnostics for the current WordPress site.
	 *
	 * Site Health must remain a read-only view of the most recent connection and
	 * sync attempts. Google API calls and diagnostic writes happen only in the
	 * connection and scheduled-sync paths.
	 *
	 * @return array Diagnostic information for the current site, with no token or query text.
	 */
	public function diagnostics(): array {
		$property = (string) get_option( self::PROPERTY_OPTION, '' );
		$payload  = [
			'status'           => $this->token_store->status(),
			'is_multisite'     => is_multisite(),
			'blog_id'          => get_current_blog_id(),
			'site_url'         => $this->site_url(),
			'site_url_source'  => defined( 'BURST_GSC_SITE_URL' ) && '' !== BURST_GSC_SITE_URL ? 'BURST_GSC_SITE_URL' : 'home_url',
			'stored_property'  => $property,
			'property_checked' => (bool) get_option( self::PROPERTY_CHECKED_OPTION, false ),
			'property_status'  => $this->property_status(),
			'property_scope'   => '' === $property ? 'not_available' : ( $this->property_is_exact( $property ) ? 'exact' : 'broader' ),
			'property_retry'   => (int) get_option( self::PROPERTY_RETRY_OPTION, 0 ),
			'sync_state'       => $this->get_state(),
			'next_sync'        => (int) wp_next_scheduled( 'burst_every_hour' ),
		];

		$payload['storage'] = '' === $property ? [] : $this->store->diagnostics( $property );
		return $payload;
	}

	/**
	 * Register burst_search_terms so the table helpers (table_exists / add_index
	 * and the daily missing-table self-heal) recognise it.
	 *
	 * @param array $tables Known Burst tables.
	 */
	public function register_table( array $tables ): array {
		$tables[] = 'burst_search_terms';
		return $tables;
	}

	/**
	 * Hourly entry point. Resolves the property, then either backfills history or
	 * runs the once-per-day increment.
	 */
	public function maybe_sync(): void {
		if ( 'connected' !== $this->token_store->status() ) {
			return;
		}

		$property = $this->resolve_property();
		if ( '' === $property ) {
			return;
		}
		$exact       = $this->property_is_exact( $property );
		$page_filter = $exact ? '' : $this->page_filter_expression();
		if ( ! $exact && '' === $page_filter ) {
			$this->logs->add( 'sync.fetch', 'error', 'Could not safely scope the broader Search Console property to this site.', [ 'property' => $property ] );
			return;
		}

		$this->store->maybe_install();
		$this->ensure_retained_history_backfill();

		$state = $this->get_state();
		if ( empty( $state['backfill_done'] ) ) {
			$this->run_backfill( $property, $state, $page_filter );
			return;
		}

		$this->run_daily( $property, $state, $page_filter );
	}

	/**
	 * Backfill all retained Search Console history, a chunk per hourly run, walking
	 * backward from the most recent available day. Runs every hour until complete.
	 *
	 * @param string $property    Search Console property.
	 * @param array  $state       Current sync state.
	 * @param string $page_filter Optional page filter for a broader property.
	 */
	private function run_backfill( string $property, array $state, string $page_filter ): void {
		if ( empty( $state['newest'] ) ) {
			$state['newest'] = $this->latest_date();
			$state['cursor'] = $state['newest'];
		}

		$oldest = $this->backfill_floor( (string) $state['newest'] );
		$cursor = (string) $state['cursor'];
		$this->logs->add(
			'sync.backfill',
			'info',
			'Started Search Console backfill chunk.',
			[
				'property'    => $property,
				'cursor'      => $cursor,
				'oldest_date' => $oldest,
			]
		);

		for ( $done = 0; $done < self::BACKFILL_CHUNK; $done++ ) {
			if ( strcmp( $cursor, $oldest ) < 0 ) {
				break;
			}
			if ( ! $this->sync_date( $property, $cursor, $page_filter ) ) {
				// Transient failure: stop and retry this cursor next hour.
				if ( '' === (string) get_option( self::PROPERTY_OPTION, '' ) ) {
					return;
				}
				break;
			}
			$cursor = $this->shift_date( $cursor, -1 );
		}

		$state['cursor'] = $cursor;
		if ( strcmp( $cursor, $oldest ) < 0 ) {
			$state['backfill_done'] = true;
			$state['last_synced']   = (string) $state['newest'];
			$state['last_run']      = time();
			unset( $state['cursor'] );
			$this->logs->add(
				'sync.backfill',
				'success',
				'Search Console backfill completed.',
				[
					'property'    => $property,
					'last_synced' => $state['last_synced'],
				]
			);
		}

		$this->save_state( $state );
	}

	/**
	 * Once-per-day increment: pull every day between the last synced day and the
	 * most recent available day (usually just one), then stamp last_run. After
	 * downtime the gap can span many days, so at most BACKFILL_CHUNK days are
	 * fetched per run and progress is persisted per day; last_run is only stamped
	 * once fully caught up, so a remaining gap continues on the next hourly run
	 * instead of waiting a day.
	 *
	 * @param string $property    Search Console property.
	 * @param array  $state       Current sync state.
	 * @param string $page_filter Optional page filter for a broader property.
	 */
	private function run_daily( string $property, array $state, string $page_filter ): void {
		$now = time();
		if ( $now - (int) ( $state['last_run'] ?? 0 ) < DAY_IN_SECONDS ) {
			return;
		}

		$latest      = $this->latest_date();
		$last_synced = (string) ( $state['last_synced'] ?? '' );

		$cursor = '' !== $last_synced ? $this->shift_date( $last_synced, 1 ) : $latest;
		// Never reach back further than the retention cap.
		$min = $this->shift_date( $latest, -( self::MAX_BACKFILL_DAYS - 1 ) );
		if ( strcmp( $cursor, $min ) < 0 ) {
			$cursor = $min;
		}

		for ( $done = 0; $done < self::BACKFILL_CHUNK; $done++ ) {
			if ( strcmp( $cursor, $latest ) > 0 ) {
				break;
			}
			if ( ! $this->sync_date( $property, $cursor, $page_filter ) ) {
				// Transient failure: last_run stays untouched, so the next hourly
				// run retries this day. Completed days are already persisted.
				return;
			}
			// Persist per day, so a mid-run fatal (e.g. max execution time on
			// web-triggered cron) never re-fetches days that already completed.
			$state['last_synced'] = $cursor;
			$this->save_state( $state );
			$cursor = $this->shift_date( $cursor, 1 );
		}

		if ( strcmp( $cursor, $latest ) > 0 ) {
			$state['last_run'] = $now;
			$this->save_state( $state );
		}
	}

	/**
	 * Fetch and store one day. Returns false on a transient API failure so the
	 * caller can retry; an empty result still counts as synced.
	 *
	 * @param string $property    Search Console property.
	 * @param string $date        The day in Y-m-d.
	 * @param string $page_filter Optional page filter for a broader property.
	 */
	private function sync_date( string $property, string $date, string $page_filter ): bool {
		$rows = $this->client->query_terms( $property, $date, $page_filter );
		if ( null === $rows ) {
			if ( $this->client->access_was_denied() ) {
				$this->mark_property_unresolved();
			}
			$this->logs->add(
				'sync.fetch',
				'error',
				'Search Console data request failed; this date will be retried.',
				[
					'property' => $property,
					'date'     => $date,
				]
			);
			return false;
		}
		$stored = $this->store->replace_day( $date, $property, $rows );
		$this->logs->add(
			'sync.store',
			$stored ? 'success' : 'error',
			$stored ? 'Stored Search Console query rows.' : 'Could not store Search Console query rows; this date will be retried.',
			[
				'property'  => $property,
				'date'      => $date,
				'row_count' => count( $rows ),
			]
		);
		return $stored;
	}

	/**
	 * Resolve and cache the most specific property containing this site.
	 */
	private function resolve_property(): string {
		$this->maybe_reset_for_site_change();

		if ( get_option( self::PROPERTY_CHECKED_OPTION ) ) {
			$retry_at      = (int) get_option( self::PROPERTY_RETRY_OPTION, 0 );
			$status_stored = null !== get_option( self::PROPERTY_STATUS_OPTION, null );
			if ( 0 < $retry_at ) {
				if ( time() < $retry_at ) {
					return '';
				}
			} elseif ( $status_stored && 'matched' === $this->property_status() ) {
				return (string) get_option( self::PROPERTY_OPTION, '' );
			}
			// A missing status option predates scoped property matching. Falling
			// through resolves once so old same-host fallbacks are validated.
		}

		$sites = $this->client->list_sites();
		if ( null === $sites ) {
			// API failure: stay unchecked so the next run retries.
			$this->logs->add( 'property.resolve', 'error', 'Could not retrieve the Search Console property list; property resolution will retry.' );
			return '';
		}

		$match    = $this->match_property( $sites );
		$property = $match['property'];
		$exact    = $match['exact'];

		// When re-resolving (e.g. after a reconnect) the account may have changed.
		// If a non-empty match differs from the property the stored state was built
		// for, the cursor + terms belong to the old property: drop them so a fresh
		// backfill runs. A same-property reconnect keeps the data and resumes the
		// daily increment. A no-match ('') leaves the data untouched.
		$previous       = (string) get_option( self::PROPERTY_OPTION, '' );
		$previous_exact = '' === $previous ? true : $this->property_is_exact( $previous );
		if ( '' !== $property && '' !== $previous && ( $previous !== $property || $previous_exact !== $exact ) ) {
			$this->store->clear();
			delete_option( self::STATE_OPTION );
		}

		update_option( self::PROPERTY_CHECKED_OPTION, true, false );
		if ( '' === $property ) {
			update_option( self::PROPERTY_STATUS_OPTION, 'none', false );
			update_option( self::PROPERTY_RETRY_OPTION, time() + self::PROPERTY_RETRY_INTERVAL, false );
		} else {
			update_option( self::PROPERTY_OPTION, $property, false );
			update_option( self::PROPERTY_EXACT_OPTION, $exact, false );
			update_option( self::PROPERTY_STATUS_OPTION, 'matched', false );
			delete_option( self::PROPERTY_RETRY_OPTION );
		}
		$this->logs->add(
			'property.resolve',
			'' === $property ? 'warning' : 'success',
			'' === $property ? 'No Search Console property matches this site.' : 'Resolved the Search Console property for this site.',
			[
				'property'       => $property,
				'property_scope' => '' === $property ? 'not_available' : ( $exact ? 'exact' : 'broader' ),
				'property_count' => count( $sites ),
				'site_url'       => $this->site_url(),
			]
		);
		return $property;
	}

	/**
	 * The site URL matched against the account's Search Console properties.
	 * BURST_GSC_SITE_URL (wp-config.php) overrides home_url(), so a local/staging
	 * install can fetch data for the real site's property.
	 */
	private function site_url(): string {
		if ( defined( 'BURST_GSC_SITE_URL' ) && '' !== BURST_GSC_SITE_URL ) {
			$url = BURST_GSC_SITE_URL;
			// parse_url() only finds a host when a scheme is present; tolerate a bare host.
			if ( ! wp_parse_url( $url, PHP_URL_SCHEME ) ) {
				$url = 'https://' . $url;
			}
			return $url;
		}
		return home_url();
	}

	/**
	 * When the site URL we fetch for changes, drop the stored terms and reset
	 * resolution + sync state so a fresh match and backfill run for the new URL.
	 */
	private function maybe_reset_for_site_change(): void {
		$current = $this->site_url();
		$stored  = get_option( self::SITE_URL_OPTION, null );
		if ( $stored === $current ) {
			return;
		}

		// Not the first run: the site actually changed, so clear the old data.
		if ( null !== $stored ) {
			$this->reset_property_resolution( true );
			$this->logs->add(
				'site.change',
				'warning',
				'The Search Console site URL changed, so cached property and query data were reset.',
				[
					'previous_site_url' => $stored,
					'site_url'          => $current,
				]
			);
		}

		update_option( self::SITE_URL_OPTION, $current, false );
	}

	/**
	 * Resolve the property immediately after connect, then schedule a near-immediate
	 * first sync so data starts arriving without waiting for the hourly cron and
	 * without blocking the OAuth popup on a full backfill chunk.
	 *
	 * @hooked burst_gsc_connected
	 */
	public function resolve_on_connect(): void {
		$this->resolve_property();
		if ( ! wp_next_scheduled( 'burst_gsc_first_sync' ) ) {
			wp_schedule_single_event( time() + 5, 'burst_gsc_first_sync' );
			$this->logs->add( 'sync.schedule', 'info', 'Scheduled the first Search Console sync.', [ 'scheduled_time' => time() + 5 ] );
		}
	}

	/**
	 * Pick the most specific verified property containing this site: an exact URL
	 * prefix, the longest broader URL prefix, then the most-specific Domain
	 * property. Broader properties are isolated with a page filter when queried.
	 *
	 * @param array $sites siteEntry[] from list_sites().
	 * @return array{property:string,exact:bool}
	 */
	private function match_property( array $sites ): array {
		$target = $this->normalize_url_prefix( $this->site_url() );
		if ( null === $target ) {
			return [
				'property' => '',
				'exact'    => false,
			];
		}

		$exact_match  = '';
		$prefix_match = '';
		$prefix_size  = 0;
		$domain_match = '';
		$domain_size  = 0;

		foreach ( $sites as $entry ) {
			$url  = isset( $entry['siteUrl'] ) ? (string) $entry['siteUrl'] : '';
			$perm = isset( $entry['permissionLevel'] ) ? (string) $entry['permissionLevel'] : '';
			if ( '' === $url || 'siteUnverifiedUser' === $perm ) {
				continue;
			}

			if ( str_starts_with( strtolower( $url ), 'sc-domain:' ) ) {
				$domain = strtolower( trim( substr( $url, strlen( 'sc-domain:' ) ), '.' ) );
				if (
					'' !== $domain
					&& ( $target['host'] === $domain || str_ends_with( $target['host'], '.' . $domain ) )
					&& strlen( $domain ) > $domain_size
				) {
					$domain_match = $url;
					$domain_size  = strlen( $domain );
				}
				continue;
			}

			$property = $this->normalize_url_prefix( $url );
			if ( null === $property ) {
				continue;
			}

			if ( $property['url'] === $target['url'] ) {
				$exact_match = $url;
				continue;
			}

			if (
				$property['origin'] === $target['origin']
				&& str_starts_with( $target['path'], $property['path'] )
				&& strlen( $property['path'] ) > $prefix_size
			) {
				$prefix_match = $url;
				$prefix_size  = strlen( $property['path'] );
			}
		}

		if ( '' !== $exact_match ) {
			return [
				'property' => $exact_match,
				'exact'    => true,
			];
		}
		if ( '' !== $prefix_match ) {
			return [
				'property' => $prefix_match,
				'exact'    => false,
			];
		}
		return [
			'property' => $domain_match,
			'exact'    => false,
		];
	}

	/**
	 * Normalize a URL-prefix property without changing path case.
	 *
	 * @return array{url:string,origin:string,host:string,port:string,path:string}|null
	 */
	private function normalize_url_prefix( string $url ): ?array {
		$parts = wp_parse_url( $url );
		if ( ! is_array( $parts ) ) {
			return null;
		}

		$scheme = isset( $parts['scheme'] ) ? strtolower( (string) $parts['scheme'] ) : '';
		$host   = isset( $parts['host'] ) ? strtolower( rtrim( (string) $parts['host'], '.' ) ) : '';
		if ( '' === $scheme || '' === $host ) {
			return null;
		}

		$port   = isset( $parts['port'] ) ? ':' . (int) $parts['port'] : '';
		$path   = isset( $parts['path'] ) ? (string) $parts['path'] : '/';
		$path   = trailingslashit( '/' . ltrim( $path, '/' ) );
		$origin = $scheme . '://' . $host . $port;

		return [
			'url'    => $origin . $path,
			'origin' => $origin,
			'host'   => $host,
			'port'   => $port,
			'path'   => $path,
		];
	}

	/**
	 * Return whether the stored property has exact site scope. Existing installs
	 * predate the scope option and only selected exact URL-prefix properties, so
	 * deriving from the URLs preserves their current unfiltered requests.
	 */
	private function property_is_exact( string $property ): bool {
		$stored = get_option( self::PROPERTY_EXACT_OPTION, null );
		if ( null !== $stored ) {
			return (bool) $stored;
		}

		$property_url = $this->normalize_url_prefix( $property );
		$site_url     = $this->normalize_url_prefix( $this->site_url() );
		return null !== $property_url && null !== $site_url && $property_url['url'] === $site_url['url'];
	}

	/**
	 * Current property state, with a migration-safe fallback for existing options.
	 */
	private function property_status(): string {
		$status = (string) get_option( self::PROPERTY_STATUS_OPTION, '' );
		if ( in_array( $status, [ 'matched', 'none', 'paused' ], true ) ) {
			return $status;
		}
		if ( ! get_option( self::PROPERTY_CHECKED_OPTION, false ) ) {
			return 'pending';
		}
		return '' === (string) get_option( self::PROPERTY_OPTION, '' ) ? 'none' : 'matched';
	}

	/**
	 * Build the RE2-compatible page filter used to isolate a broader property to
	 * this site's host and path. Protocol and a leading www are intentionally
	 * tolerant because Google may report the canonical URL under either variant.
	 */
	private function page_filter_expression(): string {
		$site = $this->normalize_url_prefix( $this->site_url() );
		if ( null === $site ) {
			return '';
		}

		$host = preg_replace( '/^www\./i', '', $site['host'] ) ?? $site['host'];
		return '^https?://(www\\.)?' . $this->escape_re2( $host . $site['port'] ) . $this->escape_re2( $site['path'] );
	}

	/**
	 * Escape RE2 metacharacters without adding PHP regex delimiters.
	 */
	private function escape_re2( string $value ): string {
		return preg_replace( '/([\\\\.\^\$\|\?\*\+\(\)\[\]\{\}])/', '\\\\$1', $value ) ?? '';
	}

	/**
	 * Stop using the cached property and schedule a daily resolution retry.
	 */
	private function mark_property_unresolved(): void {
		update_option( self::PROPERTY_CHECKED_OPTION, true, false );
		update_option( self::PROPERTY_STATUS_OPTION, 'paused', false );
		update_option( self::PROPERTY_RETRY_OPTION, time() + self::PROPERTY_RETRY_INTERVAL, false );
	}

	/**
	 * Reset property selection and, when required, its data and sync cursor.
	 */
	private function reset_property_resolution( bool $clear_data ): void {
		if ( $clear_data ) {
			$this->store->clear();
			delete_option( self::STATE_OPTION );
		}
		delete_option( self::PROPERTY_OPTION );
		delete_option( self::PROPERTY_EXACT_OPTION );
		delete_option( self::PROPERTY_STATUS_OPTION );
		delete_option( self::PROPERTY_CHECKED_OPTION );
		delete_option( self::PROPERTY_RETRY_OPTION );
	}

	/**
	 * Most recent day worth requesting (today minus the data lag), Y-m-d in UTC.
	 */
	private function latest_date(): string {
		return gmdate( 'Y-m-d', time() - self::LAG_DAYS * DAY_IN_SECONDS );
	}

	/**
	 * Oldest day to backfill: the earliest date retained by Search Console.
	 *
	 * @param string $newest The most recent day in the backfill (Y-m-d).
	 */
	private function backfill_floor( string $newest ): string {
		return $this->shift_date( $newest, -( self::MAX_BACKFILL_DAYS - 1 ) );
	}

	/**
	 * Re-open an already completed backfill once when upgrading from the
	 * activation-date scope to the full retained Search Console history.
	 */
	private function ensure_retained_history_backfill(): void {
		if ( self::BACKFILL_SCOPE === get_option( self::BACKFILL_SCOPE_OPTION ) ) {
			return;
		}

		delete_option( self::STATE_OPTION );
		update_option( self::BACKFILL_SCOPE_OPTION, self::BACKFILL_SCOPE, false );
	}

	/**
	 * Shift a Y-m-d date by a number of days (negative = earlier), anchored to UTC.
	 *
	 * @param string $date The day in Y-m-d.
	 * @param int    $days Days to add.
	 */
	private function shift_date( string $date, int $days ): string {
		return gmdate( 'Y-m-d', (int) strtotime( $date . ' UTC' ) + $days * DAY_IN_SECONDS );
	}

	/**
	 * Load sync state.
	 */
	private function get_state(): array {
		$state = get_option( self::STATE_OPTION, [] );
		return is_array( $state ) ? $state : [];
	}

	/**
	 * Persist sync state.
	 *
	 * @param array $state State to store.
	 */
	private function save_state( array $state ): void {
		update_option( self::STATE_OPTION, $state, false );
	}

	/**
	 * Register the read-only `search_console` datatable (metric allow-list + capability).
	 *
	 * @param array $config Existing datatable config keyed by id.
	 */
	public function register_datatable_config( array $config ): array {
		$config['search_console'] = [
			'metrics'    => [ 'query', 'clicks', 'impressions', 'click_through_rate', 'position' ],
			'capability' => 'view_burst_statistics',
		];
		return $config;
	}

	/**
	 * Map the `search_console` datatable to the statistics tab for shared-viewer access control.
	 *
	 * @param array $map Datatable id => tab slug.
	 */
	public function register_datatable_tab( array $map ): array {
		$map['search_console'] = 'sources';
		return $map;
	}

	/**
	 * Supply the top search-query rows for the `search_console` datatable, read from
	 * burst_search_terms for the matched property over the requested range.
	 *
	 * @param array|null $data Pre-data value (null falls through to the default engine).
	 * @param array      $args Datatable args (id, date_start/date_end as unix timestamps).
	 * @return array|null Rows for this datatable, otherwise the unchanged pre-data value.
	 */
	public function datatable_pre_data( ?array $data, array $args ): ?array {
		if ( 'search_console' !== ( $args['id'] ?? '' ) ) {
			return $data;
		}

		$property = (string) get_option( self::PROPERTY_OPTION, '' );
		if ( '' === $property || ! in_array( $this->property_status(), [ 'matched', 'paused' ], true ) ) {
			return [];
		}

		$start = isset( $args['date_start'] ) ? gmdate( 'Y-m-d', (int) $args['date_start'] ) : $this->shift_date( $this->latest_date(), -27 );
		$end   = isset( $args['date_end'] ) ? gmdate( 'Y-m-d', (int) $args['date_end'] ) : $this->latest_date();

		return $this->store->query_top( $property, $start, $end );
	}
}
