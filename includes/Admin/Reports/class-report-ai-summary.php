<?php
namespace Burst\Admin\Reports;

use Burst\Admin\Abilities_Api\Abilities_Api;
use Burst\Admin\Reports\DomainTypes\Report_Content_Block;
use Burst\Admin\Reports\DomainTypes\Report_Date_Range;
use Burst\Admin\Reports\DomainTypes\Report_Frequency;
use Burst\Admin\Statistics\Statistics_Query;
use Burst\Traits\Helper;

use function Burst\burst_loader;

defined( 'ABSPATH' ) || exit;

class Report_AI_Summary {
	use Helper;



	/**
	 * Check if the WordPress AI plugin is active and its client loaded.
	 */
	public static function is_ai_plugin_active(): bool {
		$has_abilities_api = function_exists( 'wp_register_ability' );
		$has_ai_client     = function_exists( 'wp_ai_client_prompt' )
			|| function_exists( 'WordPress\\AI\\get_ai_service' )
			|| class_exists( '\\WordPress\\AiClient\\AiClient' );

		return $has_abilities_api && $has_ai_client;
	}

	/**
	 * Check if Burst's Abilities API setting is enabled.
	 */
	public static function is_abilities_setting_enabled(): bool {
		return Abilities_Api::is_enabled();
	}

	/**
	 * Check if AI summary feature is fully available.
	 *
	 * Delegates to Abilities_Api::get_chat_availability() which checks:
	 * the abilities setting, WordPress AI plugin active, provider API key
	 * present, and connector approvals complete.
	 */
	public static function is_available(): bool {
		$chat = Abilities_Api::get_chat_availability();
		return ! empty( $chat['enabled'] );
	}

	/**
	 * Get translated explanation for why the option is disabled.
	 *
	 * Derives the reason from the same get_chat_availability() payload that
	 * the React useChatAvailability hook reads, so PHP and JS messages stay
	 * in sync. Checks are evaluated in the same order as the hook.
	 */
	public static function get_disabled_reason(): string {
		$chat = Abilities_Api::get_chat_availability();

		if ( empty( $chat['abilities_enabled'] ) ) {
			return __( 'AI summaries are disabled because Abilities API is switched off in Burst settings.', 'burst-statistics' );
		}

		if ( isset( $chat['ai_client_loaded'] ) && false === $chat['ai_client_loaded'] ) {
			return __( 'To enable AI summaries, please install and configure the WordPress AI plugin.', 'burst-statistics' );
		}

		if ( isset( $chat['has_configured_provider'] ) && false === $chat['has_configured_provider'] ) {
			return __( 'No AI connector is configured. Install the WordPress AI plugin and connect a provider to use AI summaries.', 'burst-statistics' );
		}

		$missing_approvals = $chat['missing_approvals'] ?? [];
		if ( ! empty( $missing_approvals ) ) {
			return sprintf(
				/* translators: %s is a comma-separated list of approval names (e.g. "Burst, WordPress AI, OpenAI Provider"). */
				__( 'To enable AI summaries, please go to Tools > Connector Approvals and approve the following: %s.', 'burst-statistics' ),
				implode( ', ', $missing_approvals )
			);
		}

		if ( isset( $chat['enabled'] ) && false === $chat['enabled'] ) {
			return __( 'AI summaries are currently unavailable.', 'burst-statistics' );
		}

		return '';
	}

	/**
	 * Collect structured summary data for the report date range.
	 *
	 * @param Date_Range $date_range The report date range.
	 * @return array{period: array{start: string, end: string}, compare: array<string, mixed>, top_pages: array<int, array<string, mixed>>, top_referrers: array<int, array<string, mixed>>}
	 */
	public static function collect_report_data( Date_Range $date_range ): array {
		if ( class_exists( 'Burst\\Admin\\Statistics\\Metric_Bootstrap' ) ) {
			\Burst\Admin\Statistics\Metric_Bootstrap::init();
		}

		$compare_raw = [];
		try {
			$args        = [
				'date_start'         => $date_range->start,
				'date_end'           => $date_range->end,
				'compare_date_start' => $date_range->compare_start,
				'compare_date_end'   => $date_range->compare_end,
			];
			$stats       = isset( burst_loader()->admin, burst_loader()->admin->statistics )
				? burst_loader()->admin->statistics
				: new \Burst\Admin\Statistics\Statistics();
			$compare_raw = $stats->get_compare_data( $args );
		} catch ( \Throwable $e ) {
			self::error_log( 'Report AI summary compare data collection failed: ' . $e->getMessage() );
		}

		$top_pages = [];
		try {
			$qd_pages  = Statistics_Query::create( 'report_ai_top_pages' )
				->apply_args(
					[
						'select'   => [ 'page_url', 'pageviews' ],
						'group_by' => 'page_url',
						'order_by' => 'pageviews DESC',
					]
				)
				->limit( 5 )
				->date_range( $date_range->start, $date_range->end );
			$top_pages = $qd_pages->fetch( ARRAY_A ) ?: [];
		} catch ( \Throwable $e ) {
			self::error_log( 'Report AI summary top pages collection failed: ' . $e->getMessage() );
		}

		$top_referrers = [];
		try {
			$qd_ref        = Statistics_Query::create( 'report_ai_top_referrers' )
				->apply_args(
					[
						'select'   => [ 'referrer', 'pageviews' ],
						'group_by' => 'referrer',
						'order_by' => 'pageviews DESC',
					]
				)
				->limit( 5 )
				->date_range( $date_range->start, $date_range->end );
			$top_referrers = $qd_ref->fetch( ARRAY_A ) ?: [];
		} catch ( \Throwable $e ) {
			self::error_log( 'Report AI summary top referrers collection failed: ' . $e->getMessage() );
		}

		return [
			'period'        => [
				'start' => $date_range->start_nice,
				'end'   => $date_range->end_nice,
			],
			'compare'       => $compare_raw,
			'top_pages'     => $top_pages,
			'top_referrers' => $top_referrers,
		];
	}

	/**
	 * Last error encountered during AI summary generation.
	 */
	private static string $last_error = '';

	/**
	 * Get the last error encountered during AI summary generation.
	 */
	public static function get_last_error(): string {
		return self::$last_error;
	}

	/**
	 * Build human-readable prompt data from rendered report blocks.
	 *
	 * @param array<string, array<string, mixed>> $rendered_blocks Rendered block structures.
	 * @param Report                              $report          The report instance.
	 * @return string Formatted human-readable prompt string.
	 */
	public static function build_prompt_from_blocks( array $rendered_blocks, Report $report ): string {
		$site_name    = (string) get_bloginfo( 'name' );
		$report_name  = ! empty( $report->name ) ? $report->name : __( 'Analytics Report', 'burst-statistics' );
		$report_dates = Report_Date_Range::resolve_block_dates( null, $report );

		$prompt_parts = [
			sprintf(
				"Website: %s\nReport: %s\nReport Period: %s to %s",
				$site_name,
				$report_name,
				$report_dates['start_date'],
				$report_dates['end_date']
			),
		];

		foreach ( $rendered_blocks as $block_id => $block ) {
			if ( ! is_array( $block ) || $block_id === Report_Content_Block::AI_SUMMARY ) {
				continue;
			}

			$title   = $block['title'] ?? ucfirst( str_replace( '_', ' ', (string) $block_id ) );
			$period  = $block['period'] ?? $report_dates;
			$filters = ! empty( $block['filters'] ) && is_array( $block['filters'] ) ? $block['filters'] : [];

			if ( is_string( $period ) ) {
				$period_str = $period;
			} elseif ( is_array( $period ) ) {
				$p_start    = $period['start_date'] ?? $period['start_nice'] ?? ( isset( $period['start'] ) ? gmdate( 'Y-m-d', (int) $period['start'] ) : '' );
				$p_end      = $period['end_date'] ?? $period['end_nice'] ?? ( isset( $period['end'] ) ? gmdate( 'Y-m-d', (int) $period['end'] ) : '' );
				$period_str = "$p_start to $p_end";
			} else {
				$period_str = '';
			}

			$block_text = sprintf(
				'Section: %s (%s)',
				$title,
				$period_str
			);

			if ( ! empty( $filters ) ) {
				$filter_strs = [];
				foreach ( $filters as $k => $v ) {
					if ( is_array( $v ) && isset( $v['field'], $v['value'] ) ) {
						$op            = $v['operator'] ?? 'equals';
						$filter_strs[] = sprintf( '%s %s %s', $v['field'], $op, $v['value'] );
					} else {
						$val_str       = is_array( $v ) ? implode( ', ', $v ) : (string) $v;
						$filter_strs[] = is_string( $k ) ? "$k: $val_str" : $val_str;
					}
				}
				$block_text .= "\nFilters applied: " . implode( '; ', $filter_strs );
			}

			$note = $block['comment_text'] ?? $block['content'] ?? '';
			if ( ! empty( $note ) ) {
				$block_text .= "\nAuthor notes / context: " . wp_strip_all_tags( (string) $note );
			}

			if ( ! empty( $block['data']['current'] ) && is_array( $block['data']['current'] ) ) {
				$curr        = $block['data']['current'];
				$prev        = $block['data']['previous'] ?? [];
				$block_text .= sprintf(
					"\nMetrics:\n- Pageviews: %s (previous: %s)\n- Visitors: %s (previous: %s)\n- Sessions: %s (previous: %s)\n- Bounce rate: %s%% (previous: %s%%)",
					$curr['pageviews'] ?? 0,
					$prev['pageviews'] ?? 0,
					$curr['visitors'] ?? 0,
					$prev['visitors'] ?? 0,
					$curr['sessions'] ?? 0,
					$prev['sessions'] ?? 0,
					$curr['bounce_rate'] ?? 0,
					$prev['bounce_rate'] ?? 0
				);
			} elseif ( ! empty( $block['rows'] ) && is_array( $block['rows'] ) ) {
				$row_items = [];
				foreach ( $block['rows'] as $row ) {
					if ( is_array( $row ) ) {
						$values = array_values( $row );
						if ( count( $values ) >= 2 ) {
							$label = is_scalar( $values[0] ) ? (string) $values[0] : '';
							$val   = is_array( $values[1] ) ? ( $values[1]['raw'] ?? ( $values[1]['formatted'] ?? '' ) ) : ( is_scalar( $values[1] ) ? (string) $values[1] : '' );
							if ( '' !== $label || '' !== $val ) {
								$row_items[] = "$label: $val";
							}
						} elseif ( count( $values ) === 1 ) {
							$label = is_scalar( $values[0] ) ? (string) $values[0] : '';
							if ( '' !== $label ) {
								$row_items[] = $label;
							}
						}
					} elseif ( is_scalar( $row ) ) {
						$row_items[] = (string) $row;
					}
				}
				if ( ! empty( $row_items ) ) {
					$block_text .= "\nData:\n- " . implode( "\n- ", $row_items );
				}
			} elseif ( ! empty( $block['data'] ) && is_array( $block['data'] ) && isset( reset( $block['data'] )['current'] ) ) {
				// Only scalar values are formatted: blocks may carry nested result rows (arrays or stdClass) that cannot be cast to string.
				$metric_lines = [];
				foreach ( $block['data'] as $metric => $metric_info ) {
					if ( ! is_array( $metric_info ) || ! is_scalar( $metric_info['current'] ?? null ) ) {
						continue;
					}
					$label  = ucfirst( str_replace( '_', ' ', (string) $metric ) );
					$cur    = $metric_info['current'];
					$prv    = $metric_info['previous'] ?? null;
					$chg    = $metric_info['change'] ?? null;
					$detail = [];
					if ( is_scalar( $prv ) ) {
						$detail[] = "previous: $prv";
					}
					if ( is_scalar( $chg ) ) {
						$detail[] = "change: $chg";
					}
					$metric_lines[] = ! empty( $detail )
						? sprintf( '- %s: %s (%s)', $label, $cur, implode( ', ', $detail ) )
						: sprintf( '- %s: %s', $label, $cur );
				}
				if ( ! empty( $metric_lines ) ) {
					$block_text .= "\nMetrics:\n" . implode( "\n", $metric_lines );
				}
			} elseif ( ! empty( $block['data'] ) && is_array( $block['data'] ) ) {
				$data_lines = [];
				foreach ( $block['data'] as $metric => $val ) {
					if ( is_array( $val ) && is_scalar( $val['current'] ?? null ) ) {
						$data_lines[] = sprintf( '%s: %s', ucfirst( str_replace( '-', ' ', (string) $metric ) ), $val['current'] );
					} elseif ( is_scalar( $val ) ) {
						$data_lines[] = sprintf( '%s: %s', ucfirst( str_replace( '-', ' ', (string) $metric ) ), $val );
					}
				}
				if ( ! empty( $data_lines ) ) {
					$block_text .= "\nMetrics:\n- " . implode( "\n- ", $data_lines );
				}
			}

			$prompt_parts[] = $block_text;
		}

		return implode( "\n\n", $prompt_parts ) . "\n";
	}

	/**
	 * Generate an AI summary for a report instance.
	 *
	 * Does not cache — the caller is responsible for persisting the returned
	 * string to the `ai_summary` column via a targeted `$wpdb->update`.
	 *
	 * @param Report                                              $report          The report object.
	 * @param array<string, array<string, mixed>>|Date_Range|null $rendered_blocks The rendered blocks array or legacy Date_Range.
	 * @param Date_Range|null                                     $date_range      Optional legacy date range.
	 * @return string Generated executive summary or empty string on failure.
	 */
	public static function generate_summary( Report $report, array|Date_Range|null $rendered_blocks = null, ?Date_Range $date_range = null ): string {
		self::$last_error = '';

		if ( ! self::is_available() ) {
			self::$last_error = self::get_disabled_reason();
			return '';
		}

		if ( $rendered_blocks instanceof Date_Range ) {
			$date_range      = $rendered_blocks;
			$rendered_blocks = null;
		}

		if ( null === $rendered_blocks ) {
			$reports         = new Reports();
			$rendered_blocks = $reports->render_report_blocks( $report );
		}

		if ( ! empty( $rendered_blocks ) ) {
			$data_text = self::build_prompt_from_blocks( $rendered_blocks, $report );
		} else {
			if ( null === $date_range ) {
				$frequency  = ! empty( $report->frequency ) ? $report->frequency : Report_Frequency::WEEKLY;
				$date_range = new Date_Range( $frequency );
			}

			$data      = self::collect_report_data( $date_range );
			$current   = $data['compare']['current'] ?? [];
			$previous  = $data['compare']['previous'] ?? [];
			$data_text = sprintf(
				"Website: %s\nPeriod: %s to %s\nMetrics:\n- Pageviews: %s (previous: %s)\n- Visitors: %s (previous: %s)\n- Sessions: %s (previous: %s)\n- Bounces: %s (previous: %s)\n",
				get_bloginfo( 'name' ),
				$data['period']['start'] ?? '',
				$data['period']['end'] ?? '',
				$current['pageviews'] ?? 0,
				$previous['pageviews'] ?? 0,
				$current['visitors'] ?? 0,
				$previous['visitors'] ?? 0,
				$current['sessions'] ?? 0,
				$previous['sessions'] ?? 0,
				$current['bounced_sessions'] ?? 0,
				$previous['bounced_sessions'] ?? 0
			);

			if ( ! empty( $data['top_pages'] ) && is_array( $data['top_pages'] ) ) {
				$pages_list = [];
				foreach ( $data['top_pages'] as $row ) {
					$url          = $row['page_url'] ?? '';
					$views        = $row['pageviews'] ?? 0;
					$pages_list[] = "$url ($views views)";
				}
				$data_text .= 'Top pages: ' . implode( ', ', $pages_list ) . "\n";
			}

			if ( ! empty( $data['top_referrers'] ) && is_array( $data['top_referrers'] ) ) {
				$ref_list = [];
				foreach ( $data['top_referrers'] as $row ) {
					$referrer   = $row['referrer'] ?? '';
					$views      = $row['pageviews'] ?? 0;
					$ref_list[] = "$referrer ($views views)";
				}
				$data_text .= 'Top referrers: ' . implode( ', ', $ref_list ) . "\n";
			}
		}

		$system_instruction = implode(
			' ',
			[
				'You are Burst Analytics.',
				'Summarize the provided website analytics data in 1 to 2 concise, engaging paragraphs for the site owner.',
				'Highlight overall trends, comparisons against the previous period, and top performing content or traffic sources.',
				'Do not include markdown headings, bullet points, asterisks, or code blocks.',
				'Write in clean, readable prose suitable for an email introduction and report summary.',
			]
		);

		try {
			if ( function_exists( 'wp_ai_client_prompt' ) ) {
				$builder = wp_ai_client_prompt( $data_text );
			} elseif ( function_exists( 'WordPress\\AI\\get_ai_service' ) ) {
				$builder = \WordPress\AI\get_ai_service()->create_textgen_prompt( $data_text );
			} else {
				self::$last_error = __( 'WordPress AI prompt builder is unavailable.', 'burst-statistics' );
				return '';
			}

			$summary = $builder
				->using_system_instruction( $system_instruction )
				->generate_text();

			if ( is_wp_error( $summary ) ) {
				self::$last_error = $summary->get_error_message();
				self::error_log( 'Report AI summary generation failed: ' . self::$last_error );
				return '';
			}

			return wp_kses_post( trim( (string) $summary ) );
		} catch ( \Throwable $e ) {
			self::$last_error = $e->getMessage();
			self::error_log( 'Report AI summary generation exception: ' . self::$last_error );
			return '';
		}
	}
}
