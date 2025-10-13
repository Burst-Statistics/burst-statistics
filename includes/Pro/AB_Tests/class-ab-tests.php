<?php
namespace Burst\Pro\AB_Tests;

use Burst\Admin\Statistics\Query_Data;

defined( 'ABSPATH' ) || die( 'you do not have access to this page!' );

if ( ! class_exists( 'AB_Tests' ) ) {

	/**
	 * Handle A/B test post-processing for datatable rows.
	 */
	class AB_Tests {

		/**
		 * Bootstrap filter.
		 */
		public function init(): void {
			add_filter( 'burst_datatable_data', [ $this, 'parse_for_a_b_tests' ], 10, 2 );
		}

		/**
		 * Parse datatable rows, detect A/B variants, mark winners and significance.
		 *
		 * @param array      $data       Flat rows returned for the datatable.
		 * @param Query_Data $query_data Query definition used to fetch the rows.
		 * @return array the updated array with a/b tests info.
		 */
		public function parse_for_a_b_tests( array $data, Query_Data $query_data ): array {
			// Fast exits.
			$contains_hits = ! empty( array_intersect( $query_data->select, [ 'sessions', 'visitors', 'pageviews' ] ) );
			if ( ! $contains_hits || ! \Burst\burst_loader()->admin->statistics->is_campaign_conversion_query( $query_data ) ) {
				return $data;
			}

			$campaign_parameters = \Burst\burst_loader()->admin->statistics->campaign_parameters;

			// O(1) lookup for campaign columns.
			$param_set = array_fill_keys( $campaign_parameters, true );

			$ab_tests         = [];
			$variation_prefix = 'variation-';
			$variation_len    = strlen( $variation_prefix );

			// Build A/B buckets.
			foreach ( $data as $row_index => $row ) {
				foreach ( $row as $column_name => $column_value ) {
					// Skip non-campaign columns fast.
					if ( ! isset( $param_set[ $column_name ] ) ) {
						continue;
					}

					$val = (string) $column_value;
					$pos = strpos( $val, $variation_prefix );
					if ( false === $pos ) {
						continue;
					}

					// Determine variant by next char after "variation-".
					$next = $val[ $pos + $variation_len ] ?? '';
					if ( 'a' === $next || 'A' === $next ) {
						$type = 'A';
					} elseif ( 'b' === $next || 'B' === $next ) {
						$type = 'B';
					} else {
						// not a valid a/b tag.
						continue;
					}

					// combine all column values of the campaign parameter into a single key.
					// this ensures that we can differentiate between different campaigns.
					$parts = [];
					foreach ( $campaign_parameters as $p ) {
						if ( $p === $column_name ) {
							continue;
						}
						if ( isset( $row[ $p ] ) && $row[ $p ] !== '' ) {
							$parts[] = $row[ $p ];
						}
					}
					$column_values_key = $parts !== [] ? implode( ':', $parts ) . ':' : '';

					// Normalize only a trailing "-a"/"-b" (case-insensitive).
					$normalized_key = preg_replace( '/-[ab]\z/i', '', $val );
					$key            = $column_name . ':' . $column_values_key . $normalized_key;

					if ( ! isset( $ab_tests[ $key ] ) ) {
						$ab_tests[ $key ] = [];
					}

					// Hits.
					$hits = (int) ( $row['sessions'] ?? $row['visitors'] ?? $row['pageviews'] ?? 0 );

					// Prefer provided values; compute missing ones.
					$rate  = isset( $row['conversion_rate'] ) ? ( (float) $row['conversion_rate'] / 100.0 ) : 0.0;
					$count = isset( $row['conversions'] ) ? (int) $row['conversions'] : 0;

					if ( ! isset( $row['conversions'] ) ) {
						$count = $rate * $hits;
					}
					if ( ! isset( $row['conversion_rate'] ) ) {
						$rate = $hits > 0 ? ( $count / $hits ) : 0.0;
					}

					$ab_tests[ $key ][ $type ] = [
						'index'           => $row_index,
						// 0..1
						'conversion_rate' => $rate,
						// absolute.
						'conversions'     => $count,
						'hits'            => $hits,
					];
				}
			}

			if ( empty( $ab_tests ) ) {
				return $data;
			}

			// Prune incomplete tests (must have both A and B).
			foreach ( $ab_tests as $test_key => $test ) {
				if ( ! isset( $test['A']['index'], $test['B']['index'] ) ) {
					unset( $ab_tests[ $test_key ] );
				}
			}
			if ( empty( $ab_tests ) ) {
				return $data;
			}

			// Decide winners + significance.
			foreach ( $ab_tests as $test ) {
				$hits_a = $test['A']['hits'];
				$hits_b = $test['B']['hits'];
				$rate_a = (float) $test['A']['conversion_rate'];
				$rate_b = (float) $test['B']['conversion_rate'];
				$idx_a  = (int) $test['A']['index'];
				$idx_b  = (int) $test['B']['index'];

				// Winner by rate; tie falls back to higher traffic.
				$winner = ( $rate_a > $rate_b ) ? 'A' : ( ( $rate_b > $rate_a ) ? 'B' : ( ( $hits_a >= $hits_b ) ? 'A' : 'B' ) );
				$idx_w  = ( 'A' === $winner ) ? $idx_a : $idx_b;
				$idx_l  = ( 'A' === $winner ) ? $idx_b : $idx_a;

				$data[ $idx_w ]['winner'] = true;
				$data[ $idx_l ]['winner'] = false;

				$significant = $this->determine_if_test_significant( $test );

				$data[ $idx_a ]['significant'] = $significant;
				$data[ $idx_b ]['significant'] = $significant;
				$data[ $idx_a ]['is_ab_test']  = true;
				$data[ $idx_b ]['is_ab_test']  = true;
			}

			return $data;
		}
		/**
		 * Two-proportion z-test (95% confidence).
		 * - < 300 sessions: use futility + z-test.
		 * - >= 300 sessions: hard cutoff (significant or no_winner).
		 *
		 * @param array $ab_test Array with 'A' and 'B' stats: hits, conversions, conversion_rate (0..1), index.
		 * @return string 'significant', 'still_running', or 'no_winner'.
		 */
		private function determine_if_test_significant( array $ab_test ): string {
			$hits_a = (int) $ab_test['A']['hits'];
			$hits_b = (int) $ab_test['B']['hits'];

			if ( $hits_a <= 0 || $hits_b <= 0 ) {
				return 'still_running';
			}

			$p_a = (float) $ab_test['A']['conversion_rate'];
			$p_b = (float) $ab_test['B']['conversion_rate'];

			$total_hits = $hits_a + $hits_b;
			$p_pool     = ( ( $p_a * $hits_a ) + ( $p_b * $hits_b ) ) / $total_hits;

			$var = $p_pool * ( 1.0 - $p_pool ) * ( ( 1.0 / $hits_a ) + ( 1.0 / $hits_b ) );

			if ( $var <= 0 ) {
				return 'still_running';
			}

			$z              = ( $p_a - $p_b ) / sqrt( $var );
			$is_significant = abs( $z ) >= 1.95;
			if ( $is_significant ) {
				return 'significant';
			}

			// --- FUTILITY CUTOFF CHECK ---
			$min_hits_for_futility = 300;
			// e.g. 2% difference is the minimum effect size to consider.
			$min_effect_pp = 0.02;

			if ( $total_hits >= $min_hits_for_futility ) {
				$effect = abs( $p_a - $p_b );
				if ( $effect < $min_effect_pp ) {
					return 'no_winner';
				} else {
					return 'significant';
				}
			}

			return 'still_running';
		}
	}
}
