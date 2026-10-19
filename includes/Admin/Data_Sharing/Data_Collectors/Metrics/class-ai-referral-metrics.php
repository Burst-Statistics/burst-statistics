<?php

namespace Burst\Admin\Data_Sharing\Data_Collectors\Metrics;

use Burst\Admin\Database\Query_Executor;
use Burst\Admin\Statistics\Ai_Referrer_Rules;
use Burst\Traits\Database_Helper;
use Burst\Traits\Helper;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Ai_Referral_Metrics
 *
 * Counts sessions and pageviews that started from an AI assistant within the
 * telemetry capture window. Classification is done on the fly against
 * Ai_Referrer_Rules, so the numbers do not depend on the Pro session
 * classifier having run.
 */
class Ai_Referral_Metrics {
	use Database_Helper;
	use Helper;

	private int $capture_data_from;

	private int $capture_data_to;

	/**
	 * Constructor
	 */
	public function __construct( int $capture_data_from, int $capture_data_to ) {
		$this->capture_data_from = $capture_data_from;
		$this->capture_data_to   = $capture_data_to;
	}

	/**
	 * Collect AI referral metrics.
	 *
	 * @param int $total_sessions Sessions in the same window, used for the share.
	 * @return array|null {
	 *     Null when the query failed or timed out, so "not reported" stays
	 *     distinct from "zero".
	 * @type int   $sessions  Sessions that started from an AI assistant.
	 *     @type int   $pageviews Pageviews inside those sessions.
	 *     @type float $share     Percentage of all sessions.
	 * }
	 */
	public function collect( int $total_sessions ): ?array {
		global $wpdb;

		// Only the window is user data; the host/UTM conditions are built from
		// constants and contain LIKE wildcards, so they stay out of prepare().
		$where_time = $wpdb->prepare( 'statistics.time BETWEEN %d AND %d', $this->capture_data_from, $this->capture_data_to );

		// burst_campaigns is a Pro-only table (Pro/Admin/Statistics/class-statistics.php);
		// on free it doesn't exist, so the UTM-based match is skipped there and
		// this falls back to the host-based match alone. The is_pro() check comes
		// first because free does not register the table on burst_all_tables, so
		// table_exists() would log it as an unknown table on every telemetry run.
		// The UTM tags sit on the landing hit only, so the match looks across the
		// whole session: every pageview of a UTM-tagged AI session counts, not
		// just the tagged one.
		$campaign_condition = '';
		if ( $this->is_pro() && $this->table_exists( 'burst_campaigns' ) ) {
			$campaign_condition = '
				OR EXISTS (
					SELECT 1 FROM ' . $wpdb->prefix . 'burst_statistics AS tagged
					INNER JOIN ' . $wpdb->prefix . 'burst_campaigns AS campaigns ON campaigns.statistic_id = tagged.ID
					WHERE tagged.session_id = statistics.session_id
					AND ' . Ai_Referrer_Rules::utm_condition_sql( 'campaigns.source', 'campaigns.medium' ) . '
				)';
		}

		$sql = 'SELECT COUNT(DISTINCT statistics.session_id) AS sessions, COUNT(*) AS pageviews
			FROM ' . $wpdb->prefix . 'burst_statistics AS statistics
			INNER JOIN ' . $wpdb->prefix . 'burst_sessions AS sessions ON sessions.ID = statistics.session_id
			WHERE ' . $where_time . "
			AND statistics.page_type != '404'
			AND ( " . Ai_Referrer_Rules::host_condition_sql( 'sessions.referrer' ) . $campaign_condition . '
			)';
		$sql = $this->add_query_timeout_hint( $sql, $this->resolve_query_timeout_ms( 'burst_query_timeout_ms', 'burst_query_timeout_ms_background' ) );

		// Telemetry runs once per interval, so a cached result has no reader.
		$executor = Query_Executor::create()
			->fingerprint( 'data_sharing_ai_referrals' )
			->cache_ttl( 0 );
		$row      = $executor->run( $sql, 'get_row', \ARRAY_A );

		if ( ! is_array( $row ) || $executor->timed_out || $executor->failed ) {
			return null;
		}

		$sessions = (int) ( $row['sessions'] ?? 0 );

		return [
			'sessions'  => $sessions,
			'pageviews' => (int) ( $row['pageviews'] ?? 0 ),
			'share'     => 0 === $total_sessions ? 0.0 : min( 100.0, round( ( $sessions / $total_sessions ) * 100, 2 ) ),
		];
	}
}
