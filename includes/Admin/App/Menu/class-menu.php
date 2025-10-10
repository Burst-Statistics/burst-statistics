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
	 *     default_hidden?: bool,
	 *     menu_items?: array<int, array{
	 *         id: string,
	 *         group_id: string,
	 *         title: string,
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

		// remove items where capabilities are not met.
		foreach ( $menu_items as $key => $menu_item ) {
			if ( ! current_user_can( $menu_item['capabilities'] ) ) {
				unset( $menu_items[ $key ] );
			}

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

		return apply_filters( 'burst_menu', $menu_items );
	}
}
