<?php
namespace Burst\Admin\App\Menu;

use Burst\Traits\Admin_Helper;
use Burst\Traits\Helper;

defined( 'ABSPATH' ) || die();

class Menu {

	use Admin_Helper;

	public array $menu;

	/**
	 * Get the menu items array
	 *
	 * @return array<int, array{
	 *     id: string,
	 *     title: string,
	 *     icon?: string,
	 *     default_hidden?: bool,
	 *     menu_items?: array<int, array{
	 *         id: string,
	 *         group_id: string,
	 *         title: string,
	 *         icon?: string,
	 *         groups: array<int, array{
	 *             id: string,
	 *             title: string,
	 *             pro?: array{
	 *                 url: string,
	 *                 text: string
	 *             }
	 *         }>
	 *     }>
	 * }>
	 */
	public function get(): array {
		$this->menu = require BURST_PATH . 'includes/Admin/App/config/menu.php';
		$menu_items = $this->menu;
		foreach ( $menu_items as $key => $menu_item ) {
			$sub_menu_items = $menu_item['menu_items'] ?: [];
			foreach ( $sub_menu_items as $sub_menu_item_key => $sub_menu_item ) {
				if ( isset( $sub_menu_item['groups'] ) ) {
					foreach ( $sub_menu_item['groups'] as $group_key => $group ) {
						if ( ! isset( $sub_menu_item['groups'][ $group_key ]['pro']['url'] ) ) {
							continue;
						}
						$menu_items[ $key ]['menu_items'][ $sub_menu_item_key ]['groups'][ $group_key ]['pro']['url'] = $this->get_website_url(
							$sub_menu_item['groups'][ $group_key ]['pro']['url'],
							[
								'utm_source'  => 'setting-upgrade',
								'utm_content' => $sub_menu_item['groups'][ $group_key ]['id'],
							]
						);
					}
				}
			}
		}

		$menu_items = apply_filters( 'burst_menu', $menu_items );

		return $this->remove_items_without_capability( $menu_items );
	}

	/**
	 * Remove the pages and sub pages the current user lacks the capability for.
	 *
	 * Runs after the burst_menu filter, so pages added through it (Sales,
	 * Subscriptions) are checked as well. Shared-link viewers are skipped: their
	 * access to a page comes from the share token, not from a capability, and
	 * Share_UI::allowed_tabs_for_current_shared_view() already limits their menu
	 * to the tabs the token allows.
	 *
	 * Entries that are not arrays, which a burst_menu callback could add, are
	 * dropped: no consumer can render them.
	 *
	 * @param array<int, mixed> $menu_items The filtered menu items.
	 * @return array<int, array<string, mixed>> The menu items the current user may open, re-indexed.
	 */
	private function remove_items_without_capability( array $menu_items ): array {
		$menu_items = array_values( array_filter( $menu_items, 'is_array' ) );
		$check_caps = ! $this->is_mainwp_request() && ! self::is_shareable_link_viewer();

		foreach ( $menu_items as $key => $menu_item ) {
			$capability = $this->get_item_capability( $menu_item );
			if ( $check_caps && ! current_user_can( $capability ) ) {
				unset( $menu_items[ $key ] );
				continue;
			}

			if ( empty( $menu_item['menu_items'] ) || ! is_array( $menu_item['menu_items'] ) ) {
				continue;
			}

			$sub_items = array_filter( $menu_item['menu_items'], 'is_array' );
			if ( $check_caps ) {
				$sub_items = array_filter(
					$sub_items,
					fn( array $sub_item ): bool => current_user_can( $this->get_item_capability( $sub_item, $capability ) )
				);
			}

			$menu_items[ $key ]['menu_items'] = array_values( $sub_items );
		}

		return array_values( $menu_items );
	}

	/**
	 * The capability a menu item needs.
	 *
	 * The single rule for every consumer of the menu. An item that declares no
	 * capability falls back to $fallback instead of being open to everyone.
	 *
	 * @param array<string, mixed> $item     A page or sub page.
	 * @param string               $fallback Capability for an item without one: view_burst_statistics for a page, the parent's capability for a sub page.
	 * @return string The capability.
	 */
	public function get_item_capability( array $item, string $fallback = 'view_burst_statistics' ): string {
		return isset( $item['capabilities'] ) ? (string) $item['capabilities'] : $fallback;
	}
}
