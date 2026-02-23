<?php
namespace Burst\Admin\Reports\DomainTypes;

defined( 'ABSPATH' ) || exit;

final class Report_Content_Block {
	/**
	 * Top Performers Content block.
	 */
	public const TOP_PERFORMERS = 'top_performers';

	/**
	 * Sales Content block.
	 */

	public const SALES = 'sales';

	/**
	 * Funnel Content block.
	 */

	public const FUNNEL = 'funnel';

	/**
	 * Logo Content block.
	 */

	public const LOGO = 'logo';

	/**
	 * Insights Report Content block.
	 */
	public const INSIGHTS = 'insights';

	/**
	 * Devices Report Content block.
	 */
	public const DEVICES = 'devices';

	/**
	 * Pages Report Content block.
	 */
	public const PAGES = 'pages';

	/**
	 * Parameters Report Content block.
	 */
	public const PARAMETERS = 'parameters';

	/**
	 * World Report Content block.
	 */
	public const WORLD = 'world';

	/**
	 * Locations Report Content block.
	 */
	public const LOCATIONS = 'locations';

	/**
	 * CAMPAIGNS Report Content block.
	 */
	public const CAMPAIGNS = 'campaigns';

	/**
	 * Referrers Report Content block.
	 */
	public const REFERRERS = 'referrers';

	/**
	 * Compare Report Content block.
	 */
	public const COMPARE = 'compare';

	/**
	 * Most Visited Pages Report Content block.
	 */
	public const MOST_VISITED_PAGES = 'most_visited_pages';

	/**
	 * Top Referrers Report Content block.
	 */
	public const TOP_REFERRERS = 'top_referrers';

	/**
	 * Top Campaigns Report Content block.
	 */
	public const TOP_CAMPAIGNS = 'top_campaigns';

	/**
	 * Countries Report Content block.
	 */
	public const COUNTRIES = 'countries';

	/**
	 * Default Report Content blocks.
	 */
	public const DEFAULT = [ self::COMPARE, self::MOST_VISITED_PAGES, self::TOP_REFERRERS ];

	/**
	 * All Report Content blocks.
	 */
	private const ALL = [
		self::LOGO,
		self::COMPARE,
		self::MOST_VISITED_PAGES,
		self::TOP_REFERRERS,
		self::TOP_CAMPAIGNS,
		self::COUNTRIES,
		self::INSIGHTS,
		self::DEVICES,
		self::PAGES,
		self::PARAMETERS,
		self::WORLD,
		self::LOCATIONS,
		self::CAMPAIGNS,
		self::SALES,
		self::FUNNEL,
		self::TOP_PERFORMERS,
		self::REFERRERS,
	];

	/**
	 * Filter Report Content blocks.
	 *
	 * @param string[] $content Content blocks.
	 * @return string[] Filtered content blocks.
	 */
	public static function filter( array $content ): array {
		return array_values(
			array_intersect( $content, self::ALL )
		);
	}

	/**
	 * Report Content default block.
	 *
	 * @return array<int, array{
	 *      id: string,
	 *      filters: string,
	 *      content: string,
	 *      date_range: string,
	 *      comment_title: string,
	 *      comment_text: string
	 *  }>
	 * Default content blocks.
	 */
	public static function default(): array {
		return array_map(
			fn( $id ) => [
				'id'            => $id,
				'filters'       => '',
				'content'       => '',
				'date_range'    => '',
				'comment_title' => '',
				'comment_text'  => '',
			],
			self::DEFAULT
		);
	}

	/**
	 * Get all Report Content blocks.
	 *
	 * @return array<int, array{
	 * id: string,
	 * filters: string,
	 * content: string,
	 * date_range: string,
	 * comment_title: string,
	 * comment_text: string
	 * }> All content blocks.
	 */
	public static function all(): array {
		return array_map(
			fn( $id ) => [
				'id'            => $id,
				'filters'       => '',
				'content'       => '',
				'date_range'    => '',
				'comment_title' => '',
				'comment_text'  => '',
			],
			self::ALL
		);
	}

	/**
	 * Get all Report Content block ids.
	 */
	public static function all_block_ids(): array {
		return array_map( fn( $block ) => $block['id'], self::all() );
	}

	/**
	 * Private constructor to prevent instantiation.
	 */
	private function __construct() {}
}
