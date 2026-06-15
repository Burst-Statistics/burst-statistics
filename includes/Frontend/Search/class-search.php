<?php
namespace Burst\Frontend\Search;

use Burst\Traits\Helper;

use function Burst\burst_loader;

defined( 'ABSPATH' ) || die( 'you do not have access to this page!' );

class Search {
	use Helper;

	/**
	 * Initialize the Search class.
	 */
	public function init(): void {
		add_filter( 'the_posts', [ $this, 'capture_search_and_posts' ], 10, 2 );
		add_action( 'burst_after_create_statistic', [ $this, 'link_pending_search' ], 10, 2 );
	}

	/**
	 * Capture search queries and the resulting posts.
	 *
	 * @param array     $posts The posts returned by the search query.
	 * @param \WP_Query $query The WP_Query instance for the search.
	 * @return array The original posts, unmodified.
	 */
	public function capture_search_and_posts( array $posts, \WP_Query $query ): array {
		if ( ! $query->is_search() ) {
			return $posts;
		}

		if ( burst_loader()->frontend->exclude_from_tracking() ) {
			return $posts;
		}

		$raw_term = (string) $query->get( 's', '' );

		$search_term = $raw_term;
		if ( $search_term === '' ) {
			return $posts;
		}

		$search_term = $this->sanitize_search_term( $search_term );
		if ( $search_term === '' ) {
			return $posts;
		}

		if ( self::is_spam( $search_term ) ) {
			return $posts;
		}

		if ( $this->is_long_unspaced( $search_term ) ) {
			return $posts;
		}

		// found_posts is the full match count (handles pagination), but is only
		// set when WP calculated found rows. When no_found_rows is on it stays 0,
		// so fall back to the current page count.
		$result_count = empty( $query->query_vars['no_found_rows'] )
			? $query->found_posts
			: count( $posts );

		$burst_uid    = $this->get_burst_uid();
		$statistic    = $burst_uid !== '' ? burst_loader()->frontend->tracking->get_last_user_statistic( $burst_uid ) : [];
		$statistic_id = isset( $statistic['ID'] ) ? (int) $statistic['ID'] : 0;

		$this->log_search( $statistic_id, $search_term, $result_count );

		return $posts;
	}

	/**
	 * Sanitize a raw search term before storage.
	 *
	 * @param string $search_term Raw search term.
	 * @return string Sanitized term, truncated to column width.
	 */
	private function sanitize_search_term( string $search_term ): string {
		$search_term = wp_unslash( $search_term );
		$search_term = sanitize_text_field( $search_term );
		$search_term = trim( $search_term );
		if ( function_exists( 'mb_substr' ) ) {
			$search_term = mb_substr( $search_term, 0, 191 );
		} else {
			$search_term = substr( $search_term, 0, 191 );
		}
		return $search_term;
	}

	/**
	 * Determine whether a search term is a single long token (likely spam).
	 * Filterable via `burst_search_max_unspaced_length`.
	 *
	 * @param string $search_term Sanitized search term.
	 * @return bool true when the term should be discarded.
	 */
	private function is_long_unspaced( string $search_term ): bool {
		$max_length = (int) apply_filters( 'burst_search_max_unspaced_length', 30 );
		if ( $max_length <= 0 ) {
			return false;
		}
		if ( strpos( $search_term, ' ' ) !== false ) {
			return false;
		}
		$length = function_exists( 'mb_strlen' ) ? mb_strlen( $search_term ) : strlen( $search_term );
		return $length > $max_length;
	}

	/**
	 * Log a search term against a statistic. Merges typing-style ajax searches
	 * (where the new term extends a recent shorter term for the same statistic).
	 *
	 * @param int    $statistic_id The statistic ID the search belongs to.
	 * @param string $search_term  Sanitized search term.
	 * @param int    $result_count Number of posts returned for this search.
	 */
	private function log_search( int $statistic_id, string $search_term, int $result_count ): void {
		global $wpdb;

		$now = time();

		$merge_window = (int) apply_filters( 'burst_search_merge_window', 2 * MINUTE_IN_SECONDS );
		$merged       = false;

		// Only attempt merge for linked (non-pending) rows; pending rows (statistic_id = 0)
		// have no reliable identity to merge against.
		if ( $merge_window > 0 && $statistic_id > 0 ) {
			$threshold = $now - $merge_window;

			// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$candidate = $wpdb->get_row(
				$wpdb->prepare(
					"SELECT ss.ID AS link_id, ss.search_id AS old_search_id, s.search AS old_search
					FROM {$wpdb->prefix}burst_statistics_searches ss
					INNER JOIN {$wpdb->prefix}burst_searches s ON s.ID = ss.search_id
					WHERE ss.statistic_id = %d AND ss.created >= %d
					ORDER BY ss.created DESC, ss.ID DESC
					LIMIT 1",
					$statistic_id,
					$threshold
				)
			);
			// phpcs:enable

			if ( $candidate ) {
				$old_search = (string) $candidate->old_search;
				if ( $old_search !== '' && str_starts_with( $search_term, $old_search ) ) {
					$merged = $this->merge_search(
						$statistic_id,
						(int) $candidate->link_id,
						(int) $candidate->old_search_id,
						$search_term,
						$result_count,
						$now
					);
				}
			}
		}

		if ( $merged ) {
			return;
		}

		$search_id = $this->get_or_insert_search_id( $search_term );
		if ( $search_id === 0 ) {
			return;
		}

		// Use NULL for pending rows (no statistic_id yet) so that UNIQUE(statistic_id, search_id)
		// treats each pending row as distinct — MySQL considers NULL != NULL in unique indexes.
		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		if ( $statistic_id > 0 ) {
			$wpdb->query(
				$wpdb->prepare(
					"INSERT INTO {$wpdb->prefix}burst_statistics_searches (statistic_id, search_id, result_count, created)
					VALUES (%d, %d, %d, %d)
					ON DUPLICATE KEY UPDATE result_count = VALUES(result_count), created = VALUES(created)",
					$statistic_id,
					$search_id,
					$result_count,
					$now
				)
			);
		} else {
			$wpdb->insert(
				$wpdb->prefix . 'burst_statistics_searches',
				[
					'statistic_id' => null,
					'search_id'    => $search_id,
					'result_count' => $result_count,
					'created'      => $now,
				],
				[ '%s', '%d', '%d', '%d' ]
			);
		}
		// phpcs:enable
	}

	/**
	 * Merge an in-progress typing search by repointing the existing link row to
	 * the longer search term. Removes the previous search row if orphaned.
	 *
	 * @param int    $statistic_id  The statistic the searches belong to.
	 * @param int    $link_id       The statistics_searches row id.
	 * @param int    $old_search_id The previously linked search id.
	 * @param string $new_search    The longer search term.
	 * @param int    $result_count  The latest result count.
	 * @param int    $now           Current timestamp.
	 * @return bool true on successful merge.
	 */
	private function merge_search( int $statistic_id, int $link_id, int $old_search_id, string $new_search, int $result_count, int $now ): bool {
		global $wpdb;

		$new_search_id = $this->get_or_insert_search_id( $new_search );
		if ( $new_search_id === 0 ) {
			return false;
		}

		if ( $new_search_id === $old_search_id ) {
			// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$wpdb->update(
				$wpdb->prefix . 'burst_statistics_searches',
				[
					'result_count' => $result_count,
					'created'      => $now,
				],
				[ 'ID' => $link_id ],
				[ '%d', '%d' ],
				[ '%d' ]
			);
			// phpcs:enable
			return true;
		}

		// The longer term may already have its own link row for this statistic,
		// which would collide with UNIQUE(statistic_id, search_id). If so,
		// consolidate onto that row and drop the shorter link instead.
		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$existing_link_id = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT ID FROM {$wpdb->prefix}burst_statistics_searches WHERE statistic_id = %d AND search_id = %d LIMIT 1",
				$statistic_id,
				$new_search_id
			)
		);
		// phpcs:enable

		if ( $existing_link_id > 0 && $existing_link_id !== $link_id ) {
			// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$wpdb->update(
				$wpdb->prefix . 'burst_statistics_searches',
				[
					'result_count' => $result_count,
					'created'      => $now,
				],
				[ 'ID' => $existing_link_id ],
				[ '%d', '%d' ],
				[ '%d' ]
			);
			$wpdb->delete( $wpdb->prefix . 'burst_statistics_searches', [ 'ID' => $link_id ], [ '%d' ] );
			// phpcs:enable
		} else {
			// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$updated = $wpdb->update(
				$wpdb->prefix . 'burst_statistics_searches',
				[
					'search_id'    => $new_search_id,
					'result_count' => $result_count,
					'created'      => $now,
				],
				[ 'ID' => $link_id ],
				[ '%d', '%d', '%d' ],
				[ '%d' ]
			);
			// phpcs:enable

			if ( $updated === false ) {
				return false;
			}
		}

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$remaining = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(*) FROM {$wpdb->prefix}burst_statistics_searches WHERE search_id = %d",
				$old_search_id
			)
		);

		if ( $remaining === 0 ) {
			$wpdb->delete( $wpdb->prefix . 'burst_searches', [ 'ID' => $old_search_id ], [ '%d' ] );
		}
		// phpcs:enable

		return true;
	}

	/**
	 * Find an existing search id for the given term, or insert a new one.
	 *
	 * @param string $search_term The sanitized search term.
	 * @return int The search id, or 0 on failure.
	 */
	private function get_or_insert_search_id( string $search_term ): int {
		global $wpdb;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$existing = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT ID FROM {$wpdb->prefix}burst_searches WHERE search = %s LIMIT 1",
				$search_term
			)
		);
		// phpcs:enable

		if ( $existing ) {
			return (int) $existing;
		}

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$inserted = $wpdb->insert(
			$wpdb->prefix . 'burst_searches',
			[ 'search' => $search_term ],
			[ '%s' ]
		);
		// phpcs:enable

		if ( $inserted ) {
			return $wpdb->insert_id;
		}

		// Race condition: another request inserted concurrently.
		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$existing = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT ID FROM {$wpdb->prefix}burst_searches WHERE search = %s LIMIT 1",
				$search_term
			)
		);
		// phpcs:enable

		return $existing ? (int) $existing : 0;
	}

	/**
	 * Link the oldest pending search row (statistic_id IS NULL) matching the search term
	 * in the track hit URL to the newly created statistic.
	 *
	 * @param int   $statistic_id The newly created statistic ID.
	 * @param array $statistic    The statistic data (includes 'parameters').
	 */
	public function link_pending_search( int $statistic_id, array $statistic ): void {
		if ( $statistic_id <= 0 ) {
			return;
		}

		$search_term = $statistic['search_term'] ?? '';
		if ( $search_term === '' ) {
			return;
		}

		global $wpdb;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$row_id = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT ss.ID
				FROM {$wpdb->prefix}burst_statistics_searches ss
				INNER JOIN {$wpdb->prefix}burst_searches s ON s.ID = ss.search_id
				WHERE ss.statistic_id IS NULL
				AND s.search = %s
				ORDER BY ss.created ASC
				LIMIT 1",
				$search_term
			)
		);

		if ( $row_id ) {
			$wpdb->update(
				$wpdb->prefix . 'burst_statistics_searches',
				[ 'statistic_id' => $statistic_id ],
				[ 'ID' => (int) $row_id ],
				[ '%d' ],
				[ '%d' ]
			);
		}
		// phpcs:enable
	}

	/**
	 * Check whether the search string is spam or not.
	 *
	 * @param string $search search string.
	 * @return bool true if search string is spam otherwise false.
	 */
	public static function is_spam( string $search ): bool {
		$length = function_exists( 'mb_strlen' ) ? mb_strlen( $search ) : strlen( $search );
		if ( $length === 0 ) {
			return false;
		}

		// Hard length cap: real searches are short, 150+ chars is almost always
		// pasted spam or padding.
		if ( $length > 150 ) {
			return true;
		}

		// Reject anything that looks like a link, markup or e-mail address -
		// these are link-spam, not genuine on-site searches.
		$patterns = [
			// explicit http:// or https:// scheme.
			'#https?://#i',
			// bare "www." host prefix.
			'#www\.#i',
			// domain-style TLD token, e.g. ".com", ".ru".
			'#\.[a-z]{2,4}\b#i',
			// BBCode link tags: [url= and [/url].
			'#\[/?url#i',
			// raw HTML anchor (belt-and-suspenders; sanitize usually strips it).
			'#<a\s+href#i',
			// e-mail address: local@domain.tld.
			'#[^\s@]+@[^\s@]+\.[a-z]{2,}#i',
		];
		foreach ( $patterns as $pattern ) {
			if ( preg_match( $pattern, $search ) ) {
				return true;
			}
		}

		// Four or more identical characters in a row (aaaa, !!!!): catches
		// keyboard-mashing and padding. \1 back-references the captured char.
		if ( preg_match( '/(.)\1{3,}/u', $search ) ) {
			return true;
		}

		// Symbol-heavy strings are usually spam. Strip every letter (\p{L}),
		// digit (\p{N}) and whitespace (\s); whatever is left counts as "special".
		// Flag when specials make up more than 30% of the total length.
		$specials      = (string) preg_replace( '/[\p{L}\p{N}\s]/u', '', $search );
		$special_count = function_exists( 'mb_strlen' ) ? mb_strlen( $specials ) : strlen( $specials );
		if ( ( $special_count / $length ) > 0.30 ) {
			return true;
		}

		// Reject letters from a script the site's languages don't use
		// (e.g. Chinese characters on a Latin-only site).
		if ( self::has_disallowed_script( $search ) ) {
			return true;
		}

		return false;
	}

	/**
	 * Detect letters whose script is not part of the site's languages.
	 *
	 * @param string $search Sanitized search term.
	 * @return bool true when a letter outside the allowed scripts is present.
	 */
	private static function has_disallowed_script( string $search ): bool {
		$scripts = self::get_allowed_scripts();
		if ( empty( $scripts ) ) {
			return false;
		}

		// Build a character class of every allowed Unicode script,
		// e.g. ['Latin','Cyrillic'] becomes "\p{Latin}\p{Cyrillic}".
		$allowed = '';
		foreach ( $scripts as $script ) {
			$allowed .= '\p{' . $script . '}';
		}

		// Remove all ASCII (\x00-\x7F, always allowed) plus every allowed-script
		// character. Whatever remains belongs to a foreign script.
		$stripped = preg_replace( '/[\x00-\x7F' . $allowed . ']/u', '', $search );
		if ( $stripped === null ) {
			// preg_replace failed (e.g. invalid UTF-8) - don't block on engine error.
			return false;
		}

		// Only a leftover *letter* counts as spam; stray digits/symbols are left
		// to the special-character ratio check above.
		return (bool) preg_match( '/\p{L}/u', $stripped );
	}

	/**
	 * Resolve the Unicode scripts allowed for search terms from the site locales.
	 * Filterable via `burst_search_allowed_scripts`.
	 *
	 * @return string[] PCRE Unicode script names.
	 */
	private static function get_allowed_scripts(): array {
		// Site languages: the active locale plus any installed translation locales.
		$locales = array_merge( [ (string) get_locale() ], (array) get_available_languages() );

		// 2-letter language code => the Unicode script(s) it is written in.
		$map = [
			'en' => 'Latin',
			'fr' => 'Latin',
			'de' => 'Latin',
			'es' => 'Latin',
			'it' => 'Latin',
			'pt' => 'Latin',
			'nl' => 'Latin',
			'sv' => 'Latin',
			'da' => 'Latin',
			'nb' => 'Latin',
			'nn' => 'Latin',
			'fi' => 'Latin',
			'pl' => 'Latin',
			'cs' => 'Latin',
			'sk' => 'Latin',
			'sl' => 'Latin',
			'hr' => 'Latin',
			'ro' => 'Latin',
			'hu' => 'Latin',
			'tr' => 'Latin',
			'vi' => 'Latin',
			'id' => 'Latin',
			'ms' => 'Latin',
			'et' => 'Latin',
			'lv' => 'Latin',
			'lt' => 'Latin',
			'ca' => 'Latin',
			'eu' => 'Latin',
			'gl' => 'Latin',
			'af' => 'Latin',
			'sq' => 'Latin',
			'is' => 'Latin',
			'ru' => 'Cyrillic',
			'uk' => 'Cyrillic',
			'bg' => 'Cyrillic',
			'sr' => 'Cyrillic',
			'mk' => 'Cyrillic',
			'be' => 'Cyrillic',
			'kk' => 'Cyrillic',
			'el' => 'Greek',
			'ar' => 'Arabic',
			'fa' => 'Arabic',
			'ur' => 'Arabic',
			'he' => 'Hebrew',
			'th' => 'Thai',
			'hi' => 'Devanagari',
			'mr' => 'Devanagari',
			'ne' => 'Devanagari',
			'ko' => 'Hangul',
			'ja' => [ 'Han', 'Hiragana', 'Katakana' ],
			'zh' => 'Han',
		];

		// Reduce each locale to its language code and collect the script(s) it uses.
		$scripts = [];
		foreach ( $locales as $locale ) {
			$code = strtolower( substr( (string) $locale, 0, 2 ) );
			if ( isset( $map[ $code ] ) ) {
				foreach ( (array) $map[ $code ] as $script ) {
					// keyed to de-duplicate.
					$scripts[ $script ] = true;
				}
			}
		}

		// Unknown/unmapped locale: default to Latin so English sites still work.
		if ( empty( $scripts ) ) {
			$scripts['Latin'] = true;
		}

		/**
		 * Filter the Unicode scripts allowed in search terms.
		 *
		 * @param string[] $scripts Allowed PCRE Unicode script names.
		 * @param string[] $locales Site locales used to derive them.
		 */
		return (array) apply_filters( 'burst_search_allowed_scripts', array_keys( $scripts ), $locales );
	}
}
