<?php
namespace Burst\Admin\Plugins;

use Burst\Traits\Admin_Helper;
use Burst\Traits\Helper;

defined( 'ABSPATH' ) || die( 'you do not have access to this page!' );

/**
 * Low-traffic plugin updates.
 *
 * A weekly cron determines the WINDOW_HOURS-long window with the fewest
 * visitors and stores its start hour (site timezone) in the autoloaded
 * option burst_low_traffic_time.
 *
 * On plugins.php every available-update notice gets a timing hint ("best
 * moment to update is right now / in X hours, currently N live visitors"),
 * and the auto-updates column gets a per-plugin option to schedule automatic
 * updates during the low-traffic window. Plugins that opt in are stored in
 * burst_low_traffic_auto_update_plugins and are updated by an hourly check
 * (burst_every_hour) that triggers the WordPress auto-updater once per day
 * inside the window; the auto_update_plugin filter confines their automatic
 * updates to the window, so WordPress' own twicedaily trigger can only update
 * them when it happens to fire inside the window too.
 */
class Plugin_Updates {
	use Admin_Helper;
	use Helper;

	/**
	 * Autoloaded option holding the start hour (0-23, site timezone) of the low-traffic window.
	 */
	private const LOW_TRAFFIC_TIME_OPTION = 'burst_low_traffic_time';

	/**
	 * Autoloaded option holding the plugin files that auto-update during the low-traffic window.
	 */
	private const MANAGED_PLUGINS_OPTION = 'burst_low_traffic_auto_update_plugins';

	/**
	 * Single-event hook for the initial low-traffic window calculation. Also
	 * scheduled from the 3.6.2 upgrade (10 minutes after upgrading), so the
	 * window is known before the first plugins.php visit.
	 */
	private const CALCULATE_CRON_HOOK = 'burst_calculate_low_traffic_time';

	/**
	 * Length of the low-traffic window in hours.
	 */
	private const WINDOW_HOURS = 4;

	/**
	 * Days of statistics used to determine the low-traffic window.
	 */
	private const LOOKBACK_DAYS = 28;

	/**
	 * Timestamp of the last Burst-triggered update run, in the option below.
	 * Guards the hourly check so the updater runs once per day, and detects a
	 * missed window (no cron tick during the quietest hours) for the catch-up.
	 */
	private const LAST_RUN_OPTION = 'burst_low_traffic_last_auto_update_run';

	/**
	 * Whether the current request is a Burst-triggered low-traffic update run
	 * (the hourly in-window run or its catch-up). Authorizes the decisions in
	 * the auto_update_plugin filter for this run, also when it crosses the
	 * window edge or catches up outside the window.
	 */
	private bool $is_low_traffic_run = false;

	/**
	 * Register hooks. All hooks register unconditionally and gate themselves
	 * on the settings toggles and stored opt-ins: cron events always have a
	 * handler, stored per-plugin opt-ins keep auto-updating inside the window
	 * while both toggles are off, and enabling a toggle takes effect in the
	 * request that saves it.
	 */
	public function init(): void {
		// Cron: weekly (re)calculation, the initial calculation, and the hourly
		// window check. The update trigger rides on burst_every_hour — always
		// scheduled and kept alive by the Cron class — instead of a dedicated
		// event, so there is no bespoke schedule that can go missing or stale.
		add_action( 'burst_weekly', [ $this, 'calculate_low_traffic_time' ] );
		add_action( self::CALCULATE_CRON_HOOK, [ $this, 'calculate_low_traffic_time' ] );
		add_action( 'burst_every_hour', [ $this, 'maybe_run_auto_updates' ] );

		// Confine automatic updates of managed plugins to the low-traffic window.
		add_filter( 'auto_update_plugin', [ $this, 'filter_auto_update_plugin' ], 10, 2 );

		// Some premium updaters (older EDD SL-style libraries) inject update
		// offers without the plugin property. Core's automatic updater matches
		// offers on $item->plugin (class-wp-automatic-updater.php), and so does
		// our managed check — without it such a plugin can never auto-update
		// (while manual updates, which go by array key, work fine) and core
		// throws an undefined-property warning on every run. The array key is
		// the plugin file, so fill in the gap at read time.
		add_filter( 'site_transient_update_plugins', [ $this, 'add_missing_plugin_property' ] );

		add_action( 'wp_ajax_burst_toggle_low_traffic_auto_update', [ $this, 'ajax_toggle_low_traffic_auto_update' ] );

		// Schedule the initial window calculation when a toggle is enabled.
		add_action( 'burst_after_save_field', [ $this, 'after_save_scheduling_field' ], 10, 2 );

		// UI hooks, only on the plugins screen.
		add_action( 'load-plugins.php', [ $this, 'init_plugins_screen' ] );
	}

	/**
	 * Fill in the plugin property on update offers that lack it. Core's
	 * automatic updater and our managed check both match offers on
	 * $item->plugin; offers injected by some premium updaters only carry
	 * id/slug, which blocks their auto-updates entirely and triggers an
	 * undefined-property warning in class-wp-automatic-updater.php. The
	 * transient keys the offers by plugin file, so that is the ground truth.
	 *
	 * @param mixed $transient The update_plugins transient. Mixed on purpose:
	 *                         false when the transient is not set, an object
	 *                         otherwise; we must pass both through untouched.
	 * @return mixed The transient with the plugin property completed.
	 */
	public function add_missing_plugin_property( mixed $transient ): mixed {
		if ( ! is_object( $transient ) ) {
			return $transient;
		}
		foreach ( [ 'response', 'no_update' ] as $list ) {
			if ( ! isset( $transient->{$list} ) || ! is_array( $transient->{$list} ) ) {
				continue;
			}
			foreach ( $transient->{$list} as $plugin_file => $item ) {
				if ( is_object( $item ) && ! isset( $item->plugin ) ) {
					$item->plugin = (string) $plugin_file;
				}
			}
		}
		return $transient;
	}

	/**
	 * Whether anything needs the low-traffic window: one of the two settings
	 * toggles, or stored per-plugin opt-ins.
	 */
	private function feature_in_use(): bool {
		return $this->get_option_bool( 'plugin_update_suggestions' )
			|| $this->get_option_bool( 'plugin_update_scheduling' )
			|| ! empty( $this->get_managed_plugins() );
	}

	/**
	 * Register the plugins.php UI: timing hints in update notices, the
	 * per-plugin scheduling option in the auto-updates column, styling and the
	 * live-visitors script.
	 */
	public function init_plugins_screen(): void {
		if ( ! current_user_can( 'update_plugins' ) || ! $this->user_can_view() ) {
			return;
		}

		// The toggles only gate the UI; the cron/filter hooks from init() stay
		// active regardless. Timing hints follow the suggestions toggle; the
		// auto-updates column shows whenever the feature is in use — including
		// opt-ins stored with both toggles off, so a stored opt-in can always
		// be seen and disabled.
		if ( ! $this->feature_in_use() ) {
			return;
		}
		$suggestions = $this->get_option_bool( 'plugin_update_suggestions' );

		// Make sure the window is known soon after the first visit to this
		// screen (fallback; the 3.6.2 upgrade already schedules the initial
		// calculation).
		$this->maybe_schedule_initial_calculation();

		add_filter( 'plugin_auto_update_setting_html', [ $this, 'auto_update_setting_html' ], 10, 3 );
		add_action( 'admin_print_styles', [ $this, 'print_styles' ] );
		add_action( 'admin_print_footer_scripts', [ $this, 'print_footer_script' ] );

		if ( $suggestions ) {
			// The timing hint is identical for every plugin, so hook it once per
			// plugin that has an available update.
			$updates = get_site_transient( 'update_plugins' );
			$files   = isset( $updates->response ) && is_array( $updates->response ) ? array_keys( $updates->response ) : [];
			foreach ( $files as $plugin_file ) {
				add_action( "in_plugin_update_message-{$plugin_file}", [ $this, 'update_timing_message' ] );
			}
		}
	}

	/**
	 * Schedule the initial window calculation if it never ran.
	 */
	private function maybe_schedule_initial_calculation(): void {
		if ( get_option( self::LOW_TRAFFIC_TIME_OPTION ) !== false ) {
			return;
		}
		if ( wp_next_scheduled( self::CALCULATE_CRON_HOOK ) ) {
			return;
		}
		wp_schedule_single_event( time() + 10, self::CALCULATE_CRON_HOOK );
	}

	/**
	 * Determine the low-traffic window (WINDOW_HOURS long) with the fewest
	 * visitors and store its start hour. Runs weekly, so the window follows
	 * changing traffic patterns; the hourly check picks the new window up
	 * automatically.
	 */
	public function calculate_low_traffic_time(): void {
		// Skip the aggregate query while nothing needs the window; enabling a
		// toggle later schedules the initial calculation again.
		if ( ! $this->feature_in_use() ) {
			return;
		}

		$visitors_per_hour = $this->get_visitors_per_hour();
		$start_hour        = $this->find_lowest_traffic_window_start( $visitors_per_hour );

		// Autoloaded on request: read by the auto_update_plugin filter on cron
		// and by the plugins screen.
		update_option( self::LOW_TRAFFIC_TIME_OPTION, $start_hour, true );
	}

	/**
	 * Get the visitor count per site-local hour (0-23) over the lookback period.
	 *
	 * Uses integer math on the unix timestamp instead of FROM_UNIXTIME, so the
	 * result does not depend on the MySQL session timezone. The hour alias is
	 * not on the Statistics_Query group_by allowlist, hence the direct
	 * prepared query.
	 *
	 * @return array<int, int> hour => distinct visitors.
	 */
	private function get_visitors_per_hour(): array {
		global $wpdb;
		$offset     = wp_timezone()->getOffset( new \DateTimeImmutable( 'now', wp_timezone() ) );
		$date_start = time() - self::LOOKBACK_DAYS * DAY_IN_SECONDS;

		// Direct query: the hour bucket is not on the Statistics_Query group_by
		// allowlist, and this weekly cron aggregate needs no caching.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$results = $wpdb->get_results(
			$wpdb->prepare(
				// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table prefix only.
				"SELECT MOD( time + %d, 86400 ) DIV 3600 AS hr, COUNT( DISTINCT uid ) AS visitors
				FROM {$wpdb->prefix}burst_statistics
				WHERE time > %d
				GROUP BY hr",
				$offset,
				$date_start
			),
			ARRAY_A
		);

		$visitors_per_hour = array_fill( 0, 24, 0 );
		foreach ( (array) $results as $row ) {
			$hour = (int) $row['hr'];
			if ( $hour >= 0 && $hour < 24 ) {
				$visitors_per_hour[ $hour ] = (int) $row['visitors'];
			}
		}
		return $visitors_per_hour;
	}

	/**
	 * Find the start hour of the low-traffic window (wrapping around midnight) with
	 * the fewest visitors. Ties resolve to the earliest hour.
	 *
	 * @param array<int, int> $visitors_per_hour hour => visitors.
	 */
	private function find_lowest_traffic_window_start( array $visitors_per_hour ): int {
		$best_start = 0;
		$best_sum   = PHP_INT_MAX;
		for ( $start = 0; $start < 24; $start++ ) {
			$sum = 0;
			for ( $i = 0; $i < self::WINDOW_HOURS; $i++ ) {
				$sum += $visitors_per_hour[ ( $start + $i ) % 24 ];
			}
			if ( $sum < $best_sum ) {
				$best_sum   = $sum;
				$best_start = $start;
			}
		}
		return $best_start;
	}

	/**
	 * Hourly window check (burst_every_hour): trigger the update run once per
	 * day during the low-traffic window. When cron did not tick at all during
	 * yesterday's window (the quietest hours have the fewest visits to trigger
	 * WP-Cron), a catch-up run fires at the next tick instead of silently
	 * skipping a day. Rides on the always-scheduled burst_every_hour event, so
	 * there is no bespoke schedule that can go missing or stale.
	 */
	public function maybe_run_auto_updates(): void {

		if ( empty( $this->get_managed_plugins() ) && ! $this->get_option_bool( 'plugin_update_scheduling' ) ) {
			return;
		}
		if ( $this->get_window_start_hour() === false ) {
			return;
		}

		$last_run  = (int) get_option( self::LAST_RUN_OPTION, 0 );
		$in_window = $this->is_in_low_traffic_window();

		if ( ! $in_window ) {
			if ( 0 === $last_run ) {
				// First check ever: set the baseline so the first run happens
				// in the next window instead of right now at a random hour.
				update_option( self::LAST_RUN_OPTION, time(), false );
				return;
			}
			if ( time() - $last_run <= ( 24 + self::WINDOW_HOURS ) * HOUR_IN_SECONDS ) {
				return;
			}
			// A full day passed without an in-window run: cron never ticked
			// during the window. Catch up now rather than skipping another day.
		} elseif ( $last_run > 0 && time() - $last_run < ( 24 - self::WINDOW_HOURS ) * HOUR_IN_SECONDS ) {
			// Ran earlier in this window; once per day is enough.
			return;
		}

		update_option( self::LAST_RUN_OPTION, time(), false );
		$this->run_auto_updates();
	}

	/**
	 * React to a saved smart-update-timing toggle: enabling either toggle
	 * schedules the initial window calculation if it never ran, so the hourly
	 * check has a window to work with before the first weekly recalculation.
	 *
	 * @param string $field_id    The saved field id.
	 * @param mixed  $field_value The saved value. Mixed on purpose: the settings
	 *                            system passes values of any field type through
	 *                            this hook.
	 */
	public function after_save_scheduling_field( string $field_id, mixed $field_value ): void {
		if ( ! in_array( $field_id, [ 'plugin_update_scheduling', 'plugin_update_suggestions' ], true ) ) {
			return;
		}
		if ( (bool) $field_value ) {
			$this->maybe_schedule_initial_calculation();
		}
	}

	/**
	 * Trigger the WordPress automatic updater; the auto_update_plugin filter
	 * decides per plugin. The is_low_traffic_run flag marks this run as
	 * Burst-triggered, so its decisions pass also when the run crosses the
	 * window edge or catches up after a missed window.
	 * The updater's own auto_updater.lock prevents overlapping runs.
	 */
	private function run_auto_updates(): void {
		$this->is_low_traffic_run = true;
		// Intentionally firing core's own action: this is how core itself starts
		// the automatic updater from cron (see wp_version_check()).
		// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound
		do_action( 'wp_maybe_auto_update' );
		$this->is_low_traffic_run = false;
	}

	/**
	 * Confine automatic updates of managed plugins to the low-traffic window.
	 * Unmanaged plugins keep the WordPress default.
	 *
	 * @param mixed  $update Whether to update, as determined by WordPress. Mixed on
	 *                       purpose: earlier filters may pass non-boolean values
	 *                       through and we must return those unchanged rather than
	 *                       fatal on a strict type hint.
	 * @param object $item   The update offer object.
	 * @return mixed The update decision: a bool for managed plugins, otherwise the
	 *               incoming value untouched.
	 */
	public function filter_auto_update_plugin( mixed $update, object $item ): mixed {
		// Null is core's UI probe for force-enabled/disabled auto-updates
		// (wp_is_auto_update_forced_for_item). Returning a bool there replaces
		// the enable/disable toggle with a static "Auto-updates enabled/disabled"
		// label; we only steer actual update runs, so leave the probe untouched.
		if ( null === $update ) {
			return null;
		}

		if ( $this->get_window_start_hour() === false ) {
			// Window unknown (yet): keep the WordPress default rather than blocking updates.
			return $update;
		}

		// Per-plugin opt-ins: Burst enables their auto-updates, confined to the window.
		$plugin_file = isset( $item->plugin ) ? (string) $item->plugin : '';
		if ( $plugin_file !== '' && in_array( $plugin_file, $this->get_managed_plugins(), true ) ) {
			return $this->low_traffic_update_allowed();
		}

		// Site-wide scheduling: only shifts the timing of plugins that would
		// auto-update anyway; it never enables auto-updates for other plugins.
		if ( true === $update && $this->get_option_bool( 'plugin_update_scheduling' ) ) {
			return $this->low_traffic_update_allowed();
		}

		return $update;
	}

	/**
	 * Whether a low-traffic update may run now: inside the window, or during
	 * the scheduled run itself — that event may fire after the window when
	 * WP-Cron had nothing to trigger it during the quietest hour (catch-up).
	 * WordPress' own twicedaily runs only pass inside the window.
	 */
	private function low_traffic_update_allowed(): bool {
		return $this->is_low_traffic_run || $this->is_in_low_traffic_window();
	}

	/**
	 * Start hour (0-23, site time) of the low-traffic window, or false while
	 * the window has not been calculated yet.
	 *
	 * Every window consumer — the timing hints, the auto_update_plugin filter
	 * and the daily trigger scheduling — reads the start hour through this
	 * method, so the burst_low_traffic_window_start filter shifts the whole
	 * feature coherently. That filter exists to pin or shift the window
	 * without waiting for it, e.g. from a test snippet on a staging/live site:
	 * add_filter( 'burst_low_traffic_window_start', fn( $h ) => ( $h - 17 + 24 ) % 24 );
	 *
	 * @return int|false The start hour, or false when not calculated yet.
	 */
	private function get_window_start_hour(): int|false {
		$start_hour = get_option( self::LOW_TRAFFIC_TIME_OPTION );
		if ( $start_hour === false ) {
			return false;
		}
		$filtered = apply_filters( 'burst_low_traffic_window_start', (int) $start_hour );
		if ( ! is_numeric( $filtered ) ) {
			return (int) $start_hour;
		}
		return ( ( (int) $filtered % 24 ) + 24 ) % 24;
	}

	/**
	 * Whether the current site-local hour falls inside the low-traffic window.
	 */
	private function is_in_low_traffic_window(): bool {
		$start_hour = $this->get_window_start_hour();
		if ( $start_hour === false ) {
			return false;
		}
		$now_hour = (int) current_time( 'G' );
		return ( ( $now_hour - $start_hour + 24 ) % 24 ) < self::WINDOW_HOURS;
	}

	/**
	 * Hours until the low-traffic window starts (0 when inside the window).
	 */
	private function hours_until_low_traffic_window(): int {
		if ( $this->is_in_low_traffic_window() ) {
			return 0;
		}
		$start_hour = (int) $this->get_window_start_hour();
		$now_hour   = (int) current_time( 'G' );
		return ( $start_hour - $now_hour + 24 ) % 24;
	}

	/**
	 * Plugin files whose auto-updates run during the low-traffic window.
	 *
	 * With the site-wide plugin_update_scheduling setting enabled, core's
	 * auto-update list is the single source: every plugin with auto-updates
	 * enabled runs in the window, and core's enable/disable link decides which
	 * plugins those are. Without the setting, the per-plugin opt-ins apply;
	 * Burst enables their auto-updates, confined to the window. The opt-in
	 * list stays stored while the setting is on, so switching the setting off
	 * restores the previous per-plugin choices.
	 *
	 * @return string[]
	 */
	private function get_managed_plugins(): array {
		if ( $this->get_option_bool( 'plugin_update_scheduling' ) ) {
			return array_values( (array) get_site_option( 'auto_update_plugins', [] ) );
		}

		$plugins = get_option( self::MANAGED_PLUGINS_OPTION, [] );
		return is_array( $plugins ) ? $plugins : [];
	}

	/**
	 * Append the update-timing hint to a plugin's available-update notice.
	 * The data is identical for every plugin. Two variants are rendered: one
	 * for zero live visitors ("update now") and one for visitors present
	 * (pointing to the quietest window). The shared script toggles between
	 * them on every poll, so the advice matches the live count: with zero
	 * visitors "now" is always a good moment, regardless of the window.
	 */
	public function update_timing_message(): void {
		if ( $this->get_window_start_hour() === false ) {
			return;
		}

		// Branding: the word "Burst" links to the Burst dashboard, so the source
		// of the hint is recognizable and clickable, also in translated sentences.
		$brand_html = sprintf(
			'<a class="burst-update-timing-brand" href="%s">Burst</a>',
			esc_url( BURST_DASHBOARD_URL )
		);

		if ( $this->is_in_low_traffic_window() ) {
			$zero_message = sprintf(
				// translators: %s: "Burst", linked to the Burst dashboard.
				esc_html__( '%s detects no visitors on your site right now — a good moment to update.', 'burst-statistics' ),
				$brand_html
			);
			[ $one_message, $visitors_message ] = $this->live_visitor_messages(
				// translators: 1: live visitor count (filled client-side), 2: "Burst", linked to the Burst dashboard.
				_n_noop(
					'Currently %1$s live visitor — this is the quietest time of day based on average %2$s traffic.',
					'Currently %1$s live visitors — this is the quietest time of day based on average %2$s traffic.',
					'burst-statistics'
				),
				$brand_html
			);
		} else {
			$hours = $this->hours_until_low_traffic_window();
			// translators: %d: number of hours until the low-traffic window starts.
			$hours_text   = sprintf( _n( 'in %d hour', 'in %d hours', $hours, 'burst-statistics' ), $hours );
			$zero_message = sprintf(
				// translators: 1: "Burst", linked to the Burst dashboard, 2: length of the low-traffic window in hours, 3: "in X hours" until that window starts.
				esc_html__( '%1$s detects no visitors on your site right now — a good moment to update. The quietest %2$d-hour window starts %3$s.', 'burst-statistics' ),
				$brand_html,
				self::WINDOW_HOURS,
				esc_html( $hours_text )
			);
			[ $one_message, $visitors_message ] = $this->live_visitor_messages(
				// translators: 1: live visitor count (filled client-side), 2: "Burst", linked to the Burst dashboard, 3: "in X hours" until the low-traffic window starts.
				_n_noop(
					'Currently %1$s live visitor. Based on average %2$s traffic, the quietest moment to update is %3$s.',
					'Currently %1$s live visitors. Based on average %2$s traffic, the quietest moment to update is %3$s.',
					'burst-statistics'
				),
				$brand_html,
				esc_html( $hours_text )
			);
		}

		// Link to the Integrations settings page, where the feature toggle lives.
		// The hash needs the leading slash: the app's hash router (TanStack,
		// createHashHistory) treats a slash-less hash as a relative path and
		// resolves it against the current route, doubling the path.
		$disable_html = sprintf(
			' <a class="burst-update-timing-disable" href="%s">%s</a>',
			esc_url( add_query_arg( [ 'page' => 'burst' ], admin_url( 'admin.php' ) ) . '#/settings/integrations' ),
			esc_html__( 'Disable these suggestions', 'burst-statistics' )
		);

		// The (plural) visitors variant shows first (count unknown until the
		// first poll); the script reveals the zero variant when the live count
		// is 0 and the singular variant when it is exactly 1.
		$html = sprintf(
			' <em class="burst-update-timing"><span class="burst-timing-zero" hidden>%s</span><span class="burst-timing-one" hidden>%s</span><span class="burst-timing-visitors">%s</span>%s</em>',
			$zero_message,
			$one_message,
			$visitors_message,
			$disable_html
		);
		echo wp_kses(
			$html,
			[
				'em'   => [ 'class' => [] ],
				'span' => [
					'class'  => [],
					'hidden' => [],
				],
				'a'    => [
					'class' => [],
					'href'  => [],
				],
			]
		);
	}

	/**
	 * Build the singular and plural live-visitors message from a nooped plural.
	 * The live count is only known client-side, so both plural forms are
	 * rendered (singular with count 1, plural with count 2) and the shared
	 * script reveals the variant matching the polled count.
	 *
	 * @param array  $nooped_plural Result of _n_noop(); %1$s is the live count.
	 * @param string ...$args       sprintf arguments for the remaining placeholders.
	 * @return string[] The singular and the plural message, in that order.
	 */
	private function live_visitor_messages( array $nooped_plural, string ...$args ): array {
		$count_html = '<span class="burst-live-visitors">&mdash;</span>';
		$messages   = [];
		foreach ( [ 1, 2 ] as $count ) {
			$messages[] = sprintf(
				esc_html( translate_nooped_plural( $nooped_plural, $count, 'burst-statistics' ) ),
				$count_html,
				...$args
			);
		}
		return $messages;
	}

	/**
	 * Add the per-plugin low-traffic scheduling option to the auto-updates
	 * column: a clock icon after the core enable/disable link, with the
	 * explanation in its tooltip. Both Burst toggles and the core link are
	 * always in the DOM; the burst-managed class on the wrapper decides
	 * visibility via CSS, so toggling client-side takes effect without a page
	 * refresh.
	 *
	 * @param mixed  $html        The core auto-update column HTML. Mixed on purpose:
	 *                            another plugin filtering earlier could return a
	 *                            non-string, which a strict hint would turn into a
	 *                            fatal; we coerce to string instead.
	 * @param string $plugin_file The plugin file.
	 * @param array  $plugin_data The plugin data, including the update-supported flag.
	 */
	public function auto_update_setting_html( mixed $html, string $plugin_file, array $plugin_data = [] ): string {
		$html = is_string( $html ) ? $html : '';

		// No clock where core offers no auto-updates either (e.g. plugins
		// without an update source): the column stays empty for consistency.
		if ( empty( $plugin_data['update-supported'] ) ) {
			return $html;
		}

		if ( $this->get_option_bool( 'plugin_update_scheduling' ) ) {
			return $this->scheduling_setting_html( $html, $plugin_file );
		}

		return $this->per_plugin_setting_html( $html, $plugin_file );
	}

	/**
	 * Column content while the site-wide scheduling setting is enabled: core's
	 * enable/disable link is the only control (auto-updates stay switchable per
	 * plugin), and auto-updating plugins get a green clock as status indicator.
	 * No Burst toggles: a per-plugin opt-in would be ignored in this mode.
	 *
	 * @param string $html        The core auto-update column HTML.
	 * @param string $plugin_file The plugin file.
	 */
	private function scheduling_setting_html( string $html, string $plugin_file ): string {
		$scheduled = in_array( $plugin_file, $this->get_managed_plugins(), true );

		$tooltip = __( 'Automatic updates for this plugin run when Burst traffic is lowest. Enabled site-wide in Burst via the "Schedule auto-updates during quiet traffic periods" setting.', 'burst-statistics' );
		$status  = sprintf(
			'<span class="burst-lta-scheduled" title="%s"><span class="dashicons dashicons-clock" aria-hidden="true"></span><span class="screen-reader-text">%s</span></span>',
			esc_attr( $tooltip ),
			esc_html( $tooltip )
		);

		return sprintf(
			'<span class="burst-auto-update-setting%s" data-plugin="%s">%s%s</span>',
			$scheduled ? ' burst-scheduled' : '',
			esc_attr( $plugin_file ),
			$html,
			$status
		);
	}

	/**
	 * Column content without the site-wide scheduling setting: a grey clock to
	 * opt the plugin in to Burst-managed low-traffic auto-updates, or — when
	 * opted in — the Burst disable link replacing the core toggle.
	 *
	 * @param string $html        The core auto-update column HTML.
	 * @param string $plugin_file The plugin file.
	 */
	private function per_plugin_setting_html( string $html, string $plugin_file ): string {
		$managed = in_array( $plugin_file, $this->get_managed_plugins(), true );

		$enable_link  = $this->clock_toggle_html(
			$plugin_file,
			'burst-lta-enable',
			__( 'Schedule auto-updates when Burst traffic is lowest', 'burst-statistics' )
		);
		$disable_link = $this->clock_toggle_html(
			$plugin_file,
			'burst-lta-disable',
			__( 'Automatic updates for this plugin run when Burst traffic is lowest', 'burst-statistics' ),
			__( 'Disable low-traffic auto-updates', 'burst-statistics' )
		);

		return sprintf(
			'<span class="burst-auto-update-setting%s">%s%s%s</span>',
			$managed ? ' burst-managed' : '',
			$html,
			$enable_link,
			$disable_link
		);
	}

	/**
	 * Build a clock-icon toggle link for the auto-updates column. Without a
	 * visible label the tooltip text doubles as screen-reader text, keeping
	 * the column visually compact; with a visible label the link reads like
	 * the core enable/disable auto-updates action.
	 *
	 * @param string $plugin_file   The plugin file the toggle applies to.
	 * @param string $state_class   burst-lta-enable or burst-lta-disable.
	 * @param string $tooltip       Tooltip explaining the toggle.
	 * @param string $visible_label Optional label shown next to the clock icon.
	 */
	private function clock_toggle_html( string $plugin_file, string $state_class, string $tooltip, string $visible_label = '' ): string {
		$label_html = $visible_label === ''
			? '<span class="screen-reader-text">' . esc_html( $tooltip ) . '</span>'
			: '<span class="burst-lta-label">' . esc_html( $visible_label ) . '</span>';

		return sprintf(
			'<a href="#" class="burst-lta-toggle %1$s" data-plugin="%2$s" title="%3$s">%4$s<span class="dashicons dashicons-clock" aria-hidden="true"></span></a>',
			esc_attr( $state_class ),
			esc_attr( $plugin_file ),
			esc_attr( $tooltip ),
			$label_html
		);
	}

	/**
	 * Styles for the auto-updates column: hide the core enable/disable link
	 * when Burst manages the plugin, and show the matching Burst link.
	 */
	public function print_styles(): void {
		?>
		<style>
			.burst-auto-update-setting {
				display: inline-flex;
				align-items: center;
				flex-wrap: wrap;
				gap: 0 6px;
			}
			/* Keep the clock right after the enable/disable link; the
				auto-update-time div gets its own row below. */
			.burst-auto-update-setting .auto-update-time {
				flex-basis: 100%;
				order: 3;
			}
			.burst-auto-update-setting .burst-lta-toggle {
				order: 2;
				display: inline-flex;
				align-items: center;
				gap: 4px;
				text-decoration: none;
			}
			.burst-auto-update-setting .burst-lta-toggle .dashicons-clock {
				font-size: 16px;
				width: 16px;
				height: 16px;
			}
			.burst-auto-update-setting .burst-lta-enable .dashicons-clock {
				color: #787c82;
			}
			.burst-auto-update-setting .burst-lta-enable:hover .dashicons-clock,
			.burst-auto-update-setting .burst-lta-enable:focus .dashicons-clock {
				color: #2271b1;
			}
			.burst-auto-update-setting .burst-lta-disable .dashicons-clock {
				color: var(--rsp-green, #2e8a37);
			}
			.burst-auto-update-setting .burst-lta-disable:hover .dashicons-clock,
			.burst-auto-update-setting .burst-lta-disable:focus .dashicons-clock {
				color: #b32d2e;
			}
			.burst-auto-update-setting .burst-lta-scheduled {
				order: 2;
				display: none;
				align-items: center;
			}
			.burst-auto-update-setting .burst-lta-scheduled .dashicons-clock {
				font-size: 16px;
				width: 16px;
				height: 16px;
				color: var(--rsp-green, #2e8a37);
			}
			.burst-auto-update-setting .burst-lta-disable,
			.burst-auto-update-setting.burst-managed .burst-lta-enable,
			.burst-auto-update-setting.burst-managed .toggle-auto-update,
			.burst-auto-update-setting.burst-managed .auto-update-time {
				display: none;
			}
			.burst-auto-update-setting.burst-managed .burst-lta-disable,
			.burst-auto-update-setting.burst-scheduled .burst-lta-scheduled {
				display: inline-flex;
			}
		</style>
		<?php
	}

	/**
	 * One shared script for the plugins screen: fills the live-visitors count
	 * in every update notice (single fetch, polled every 20s) and handles the
	 * low-traffic auto-update toggle client-side.
	 */
	public function print_footer_script(): void {
		// Two nonce layers for the data endpoint: the wp_rest nonce (X-WP-Nonce
		// header) authenticates the cookie for the REST permission_callback, and
		// Burst's own burst_nonce query param is verified inside the data handler.
		$rest_url     = add_query_arg( 'nonce', wp_create_nonce( 'burst_nonce' ), rest_url( 'burst/v1/data/live-visitors' ) );
		$rest_nonce   = wp_create_nonce( 'wp_rest' );
		$ajax_url     = admin_url( 'admin-ajax.php' );
		$toggle_nonce = wp_create_nonce( 'burst_toggle_low_traffic_auto_update' );
		?>
		<script>
			( function() {
				var restUrl           = <?php echo wp_json_encode( $rest_url ); ?>;
				var restNonce         = <?php echo wp_json_encode( $rest_nonce ); ?>;
				var ajaxUrl           = <?php echo wp_json_encode( $ajax_url ); ?>;
				var toggleNonce       = <?php echo wp_json_encode( $toggle_nonce ); ?>;
				var schedulingEnabled = <?php echo wp_json_encode( $this->get_option_bool( 'plugin_update_scheduling' ) ); ?>;

				// With the site-wide scheduling setting on, a plugin that just got
				// core auto-updates enabled is covered by low-traffic scheduling.
				// Core fires this jQuery event after its enable/disable AJAX
				// succeeds; sync the green status clock so the row matches what a
				// refresh would show. Core's own enable/disable link stays as-is.
				if ( schedulingEnabled && window.jQuery ) {
					jQuery( document ).on( 'wp-auto-update-setting-changed', function( event, data ) {
						if ( ! data || data.type !== 'plugin' || ! data.asset ) {
							return;
						}
						var wrapper = document.querySelector( '.burst-auto-update-setting[data-plugin="' + data.asset + '"]' );
						if ( wrapper ) {
							wrapper.classList.toggle( 'burst-scheduled', data.state === 'enable' );
						}
					} );
				}

				// Live visitors: one fetch for all update notices, polled every 20s.
				// Fills every count span and switches each timing hint between its
				// zero-visitors variant ("update now") and its visitors variant.
				function applyLiveVisitors( count ) {
					document.querySelectorAll( '.burst-live-visitors' ).forEach( function( span ) {
						span.textContent = count;
					} );
					document.querySelectorAll( '.burst-update-timing' ).forEach( function( hint ) {
						var zero     = hint.querySelector( '.burst-timing-zero' );
						var one      = hint.querySelector( '.burst-timing-one' );
						var visitors = hint.querySelector( '.burst-timing-visitors' );
						if ( zero && one && visitors ) {
							zero.hidden     = count !== 0;
							one.hidden      = count !== 1;
							visitors.hidden = count < 2;
						}
					} );
				}

				function updateLiveVisitors() {
					// Skip while the tab is hidden: a background plugins.php tab
					// should not keep polling the REST API.
					if ( document.hidden || ! document.querySelector( '.burst-update-timing' ) ) {
						return;
					}
					fetch( restUrl, {
						headers: { 'X-WP-Nonce': restNonce },
						credentials: 'same-origin'
					} )
						.then( function( response ) { return response.json(); } )
						.then( function( json ) {
							if ( ! json || ! json.data || typeof json.data.visitors === 'undefined' ) {
								return;
							}
							applyLiveVisitors( parseInt( json.data.visitors, 10 ) || 0 );
						} )
						.catch( function() {} );
				}
				updateLiveVisitors();
				setInterval( updateLiveVisitors, 20000 );
				// Refresh immediately when the tab becomes visible again.
				document.addEventListener( 'visibilitychange', function() {
					if ( ! document.hidden ) {
						updateLiveVisitors();
					}
				} );

				// All Burst click handling runs in the CAPTURE phase with
				// stopPropagation(): the update row has delegated bubble-phase
				// listeners (core's shiny updates, update-manager plugins) that
				// otherwise hijack clicks bubbling up from our links — showing
				// the update spinner instead of following the link.
				document.addEventListener( 'click', function( event ) {
					if ( ! event.target.closest ) {
						return;
					}

					// Plain links in the timing hint (the "Burst" brand link and
					// "Disable these suggestions"): keep the default navigation,
					// hide the click from delegated listeners on the row.
					if ( event.target.closest( '.burst-update-timing a' ) ) {
						event.stopPropagation();
						return;
					}

					// Low-traffic auto-update toggle: flip the wrapper class for an
					// instant UI update (CSS hides/shows the core toggle and the
					// Burst links), then persist via AJAX. Revert on failure.
					var link = event.target.closest( '.burst-lta-toggle' );
					if ( ! link ) {
						return;
					}
					event.preventDefault();
					event.stopPropagation();

					var wrapper = link.closest( '.burst-auto-update-setting' );
					if ( ! wrapper ) {
						return;
					}
					var enable = ! wrapper.classList.contains( 'burst-managed' );
					wrapper.classList.toggle( 'burst-managed', enable );

					var body = 'action=burst_toggle_low_traffic_auto_update'
						+ '&plugin=' + encodeURIComponent( link.getAttribute( 'data-plugin' ) )
						+ '&enable=' + ( enable ? '1' : '0' )
						+ '&nonce=' + encodeURIComponent( toggleNonce );
					fetch( ajaxUrl, {
						method: 'POST',
						credentials: 'same-origin',
						headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
						body: body
					} )
						.then( function( response ) { return response.json(); } )
						.then( function( json ) {
							if ( ! json || ! json.success ) {
								wrapper.classList.toggle( 'burst-managed', ! enable );
							}
						} )
						.catch( function() {
							wrapper.classList.toggle( 'burst-managed', ! enable );
						} );
				}, true );
			} )();
		</script>
		<?php
	}

	/**
	 * Toggle low-traffic auto-updates for one plugin: update the managed list
	 * and (re)schedule or clear the daily trigger accordingly.
	 */
	public function ajax_toggle_low_traffic_auto_update(): void {
		if ( ! current_user_can( 'update_plugins' ) ) {
			wp_send_json_error( 'Unauthorized', 403 );
		}
		$nonce = isset( $_POST['nonce'] ) ? sanitize_text_field( wp_unslash( $_POST['nonce'] ) ) : '';
		if ( ! wp_verify_nonce( $nonce, 'burst_toggle_low_traffic_auto_update' ) ) {
			wp_send_json_error( 'Unauthorized', 403 );
		}

		$plugin_file = isset( $_POST['plugin'] ) ? sanitize_text_field( wp_unslash( $_POST['plugin'] ) ) : '';
		if ( ! $this->is_installed_plugin( $plugin_file ) ) {
			wp_send_json_error( null, 400 );
		}
		$enable = isset( $_POST['enable'] ) && sanitize_text_field( wp_unslash( $_POST['enable'] ) ) === '1';

		$managed = $this->get_managed_plugins();
		if ( $enable ) {
			$managed[] = $plugin_file;
			$managed   = array_values( array_unique( $managed ) );
		} else {
			$managed = array_values( array_diff( $managed, [ $plugin_file ] ) );
		}
		// Autoloaded: read by the auto_update_plugin filter on cron requests.
		update_option( self::MANAGED_PLUGINS_OPTION, $managed, true );

		// No trigger to (re)schedule: the hourly check picks the change up.
		if ( $enable ) {
			$this->maybe_schedule_initial_calculation();
		}

		wp_send_json_success();
	}

	/**
	 * Whether the given plugin file belongs to an installed plugin.
	 */
	private function is_installed_plugin( string $plugin_file ): bool {
		if ( $plugin_file === '' ) {
			return false;
		}
		if ( ! function_exists( 'get_plugins' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}
		return array_key_exists( $plugin_file, get_plugins() );
	}
}
