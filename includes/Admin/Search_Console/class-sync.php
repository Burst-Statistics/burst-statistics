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
	 * Resolved Search Console property (siteUrl). Auto-matched to home_url() from
	 * the account's property list, then reused. A cached empty string (once
	 * checked) means no property matched this site.
	 */
	private const PROPERTY_OPTION = 'burst_gsc_property';

	/**
	 * Flags that property resolution has completed at least one API attempt, so a
	 * stored empty PROPERTY_OPTION reads as "no match" rather than "not yet checked".
	 */
	private const PROPERTY_CHECKED_OPTION = 'burst_gsc_property_checked';

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
	 * Search Console data is delayed ~2 days, so this is the most recent day worth requesting.
	 */
	private const LAG_DAYS = 2;

	/**
	 * Hard cap on how far back to backfill: Search Console retains ~16 months, so
	 * older days are pointless to query. The actual floor is the plugin install
	 * date (see backfill_floor()).
	 */
	private const MAX_BACKFILL_DAYS = 480;

	/**
	 * Days fetched per hourly run while backfilling.
	 */
	private const BACKFILL_CHUNK = 10;

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
	 * Constructor.
	 */
	public function __construct() {
		$this->token_store = new Token_Store();
		$this->client      = new Client( $this->token_store );
		$this->store       = new Search_Terms_Store();
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

		$this->store->maybe_install();

		$state = $this->get_state();
		if ( empty( $state['backfill_done'] ) ) {
			$this->run_backfill( $property, $state );
			return;
		}

		$this->run_daily( $property, $state );
	}

	/**
	 * Backfill history, a chunk per hourly run, walking backward from the most
	 * recent available day down to the install date. Runs every hour until complete.
	 *
	 * @param string $property Search Console property.
	 * @param array  $state    Current sync state.
	 */
	private function run_backfill( string $property, array $state ): void {
		if ( empty( $state['newest'] ) ) {
			$state['newest'] = $this->latest_date();
			$state['cursor'] = $state['newest'];
		}

		$oldest = $this->backfill_floor( (string) $state['newest'] );
		$cursor = (string) $state['cursor'];

		for ( $done = 0; $done < self::BACKFILL_CHUNK; $done++ ) {
			if ( strcmp( $cursor, $oldest ) < 0 ) {
				break;
			}
			if ( ! $this->sync_date( $property, $cursor ) ) {
				// Transient failure: stop and retry this cursor next hour.
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
	 * @param string $property Search Console property.
	 * @param array  $state    Current sync state.
	 */
	private function run_daily( string $property, array $state ): void {
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
			if ( ! $this->sync_date( $property, $cursor ) ) {
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
	 * @param string $property Search Console property.
	 * @param string $date     The day in Y-m-d.
	 */
	private function sync_date( string $property, string $date ): bool {
		$rows = $this->client->query_terms( $property, $date );
		if ( null === $rows ) {
			return false;
		}
		return $this->store->replace_day( $date, $property, $rows );
	}

	/**
	 * Resolve and cache the property to query: the one matching home_url() in the
	 * account's property list. Cached after the first completed API attempt (a
	 * cached empty string then means no property matched). Returns '' until checked
	 * or on no match.
	 */
	private function resolve_property(): string {
		$this->maybe_reset_for_site_change();

		if ( get_option( self::PROPERTY_CHECKED_OPTION ) ) {
			return (string) get_option( self::PROPERTY_OPTION, '' );
		}

		$sites = $this->client->list_sites();
		if ( null === $sites ) {
			// API failure: stay unchecked so the next run retries.
			return '';
		}

		$property = $this->match_property( $sites );

		// When re-resolving (e.g. after a reconnect) the account may have changed.
		// If a non-empty match differs from the property the stored state was built
		// for, the cursor + terms belong to the old property: drop them so a fresh
		// backfill runs. A same-property reconnect keeps the data and resumes the
		// daily increment. A no-match ('') leaves the data untouched.
		$previous = (string) get_option( self::PROPERTY_OPTION, '' );
		if ( '' !== $property && '' !== $previous && $previous !== $property ) {
			$this->store->clear();
			delete_option( self::STATE_OPTION );
		}

		update_option( self::PROPERTY_OPTION, $property, false );
		update_option( self::PROPERTY_CHECKED_OPTION, true, false );
		return $property;
	}

	/**
	 * The site URL matched against the account's Search Console properties.
	 * BURST_GSC_SITE_URL (wp-config.php) overrides home_url(), so a local/staging
	 * install can fetch data for the real site's property. Matching still applies
	 * the www / non-www and URL-prefix vs sc-domain logic in match_property().
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
			$this->store->clear();
			delete_option( self::PROPERTY_OPTION );
			delete_option( self::PROPERTY_CHECKED_OPTION );
			delete_option( self::STATE_OPTION );
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
		}
	}

	/**
	 * Pick the property that matches this site: an exact URL-prefix match wins,
	 * otherwise a host / sc-domain match on home_url()'s host. Unverified
	 * properties are skipped.
	 *
	 * @param array $sites siteEntry[] from list_sites().
	 */
	private function match_property( array $sites ): string {
		$site_url    = $this->site_url();
		$home_prefix = untrailingslashit( strtolower( $site_url ) );
		$home_host   = $this->bare_host( (string) wp_parse_url( $site_url, PHP_URL_HOST ) );
		$fallback    = '';

		foreach ( $sites as $site ) {
			$url  = isset( $site['siteUrl'] ) ? (string) $site['siteUrl'] : '';
			$perm = isset( $site['permissionLevel'] ) ? (string) $site['permissionLevel'] : '';
			if ( '' === $url || 'siteUnverifiedUser' === $perm ) {
				continue;
			}

			if ( str_starts_with( $url, 'sc-domain:' ) ) {
				$domain = $this->bare_host( substr( $url, strlen( 'sc-domain:' ) ) );
				if ( $domain === $home_host && '' === $fallback ) {
					$fallback = $url;
				}
				continue;
			}

			if ( untrailingslashit( strtolower( $url ) ) === $home_prefix ) {
				return $url;
			}
			$url_host = $this->bare_host( (string) wp_parse_url( $url, PHP_URL_HOST ) );
			if ( $url_host === $home_host && '' === $fallback ) {
				$fallback = $url;
			}
		}

		return $fallback;
	}

	/**
	 * Lower-case host without a leading www.
	 *
	 * @param string $host Host to normalise.
	 */
	private function bare_host( string $host ): string {
		return (string) preg_replace( '/^www\./', '', strtolower( $host ) );
	}

	/**
	 * Most recent day worth requesting (today minus the data lag), Y-m-d in UTC.
	 */
	private function latest_date(): string {
		return gmdate( 'Y-m-d', time() - self::LAG_DAYS * DAY_IN_SECONDS );
	}

	/**
	 * Oldest day to backfill: the plugin install date, but never further back than
	 * the retention cap.
	 *
	 * @param string $newest The most recent day in the backfill (Y-m-d).
	 */
	private function backfill_floor( string $newest ): string {
		$cap     = $this->shift_date( $newest, -( self::MAX_BACKFILL_DAYS - 1 ) );
		$install = (int) get_option( 'burst_activation_time', 0 );
		if ( $install <= 0 ) {
			return $cap;
		}
		$floor = gmdate( 'Y-m-d', $install );
		return strcmp( $floor, $cap ) < 0 ? $cap : $floor;
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
		$map['search_console'] = 'statistics';
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
		if ( '' === $property ) {
			return [];
		}

		$start = isset( $args['date_start'] ) ? gmdate( 'Y-m-d', (int) $args['date_start'] ) : $this->shift_date( $this->latest_date(), -27 );
		$end   = isset( $args['date_end'] ) ? gmdate( 'Y-m-d', (int) $args['date_end'] ) : $this->latest_date();

		return $this->store->query_top( $property, $start, $end );
	}
}
