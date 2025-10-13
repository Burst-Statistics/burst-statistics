<?php
namespace Burst\Admin\Capability;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Capability {
	/**
	 * Constructor
	 */
	public function init(): void {
		add_action( 'wp_initialize_site', [ $this, 'add_role_to_subsite' ], 10, 1 );
	}

	/**
	 * Add capability to a user
	 */
	public static function add_capability( string $type = 'view', array $roles = [ 'administrator' ], bool $handle_subsites = true ): void {
		$possible_capabilities = [ 'view', 'manage' ];
		if ( ! in_array( $type, $possible_capabilities, true ) ) {
			return;
		}

		$capability = "{$type}_burst_statistics";
		$roles      = apply_filters( "burst_add_{$type}_capability", $roles );
		foreach ( $roles as $role ) {
			$role = get_role( $role );
			if ( $role !== null && ! $role->has_cap( $capability ) ) {
				$role->add_cap( $capability );
			}
		}

		// we need to add this role across subsites as well.
		if ( $handle_subsites && is_multisite() ) {
			$sites = get_sites();
			if ( count( $sites ) > 0 ) {
				foreach ( $sites as $site ) {
					switch_to_blog( (int) $site->blog_id );
					self::add_capability( $type, $roles, false );
					restore_current_blog();
				}
			}
		}
	}

	/**
	 * When a new site is added, add our capability
	 */
	public function add_role_to_subsite( \WP_Site $site ): void {
		switch_to_blog( (int) $site->blog_id );
		self::add_capability( 'manage' );
		self::add_capability( 'view', [ 'administrator', 'editor' ], false );
		restore_current_blog();
	}
}
