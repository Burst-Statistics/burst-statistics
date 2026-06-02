/**
 * Types for `burst_settings` localized by PHP (`trait-admin-helper.php` + filters).
 */

export interface BurstMenuPro {
	url: string;
	text: string;
}

export interface BurstMenuGroup {
	id: string;
	title: string;
	pro?: BurstMenuPro;
}

export interface BurstMenuItem {
	id: string;
	group_id: string;
	title: string;
	groups: BurstMenuGroup[];
	hidden?: boolean;
	capabilities?: string;
}

export interface BurstMenuPage {
	id: string;
	title: string;
	default_hidden: boolean;
	menu_items: BurstMenuItem[];
	capabilities: string;
	menu_slug: string;
	show_in_admin: boolean;
	show_in_admin_plugin_overview?: boolean;
	shareable?: boolean;
	pro?: boolean;
	location?: 'left' | 'right';
}

export type BurstMenuConfig = BurstMenuPage[] | Record<number, BurstMenuPage>;

/**
 * Script localization object on `window.burst_settings`.
 */
export interface BurstSettings {
	burst_version: string;

	/** PHP may localize as boolean or `"1"` / `"0"`. */
	is_pro: boolean | string;
	plugin_url: string;
	installed_by?: string;
	rest_url: string;
	site_url: string;
	admin_ajax_url: string;
	dashboard_url: string;
	network_link?: string;
	nonce: string;
	burst_nonce: string;
	current_ip?: string;
	user_roles: Record<string, string>;
	view_sales_burst_statistics: boolean;
	manage_burst_statistics: boolean;
	can_install_plugins: boolean;
	share_link_permissions?: Record<string, unknown>;
	json_translations: string[];
	date_format: string;
	gmt_offset: string | number;
	burst_activation_time: number;
	date_ranges: string[];
	time_format: string;
	burst_date_picker_start_date: number;
	menu: BurstMenuConfig;
	fields?: Record<string, unknown>;
	chat_availability?: Record<string, unknown>;
	shouldLoadEcommerce?: boolean;
	ecommerceActivationTime?: number;
	countries?: Record<string, string>;
	continents?: Record<string, string>;
	is_mainwp?: boolean;
	root?: string;
	child_token?: string;

	/** True once the first external-links scraping cycle has completed. */
	external_links_first_cycle_completed?: boolean;

	/** Pro license bootstrap (localized before React Query fetch). */
	licenseStatus?: string;
	tier?: string;
	activationLimit?: number;
	activationsLeft?: number;
	licenseExpiresDate?: string;
	licenseIsLifetime?: boolean;
}

declare global {
	interface Window {
		burst_settings: BurstSettings;
	}
}

export {};
