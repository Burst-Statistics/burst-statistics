<?php
defined( 'ABSPATH' ) or die();
add_action( 'init', 'burst_check_upgrade', 10, 2 );

/**
 * Run an upgrade procedure if the version has changed
 */
function burst_check_upgrade() {
	// only run upgrade check if cron, or if admin.
	if ( ! is_admin() && ! wp_doing_cron() ) {
		return;
	}

	$prev_version = get_option( 'burst-current-version', false );
	$new_version  = burst_version;

	// strip off everything after '#'
	if ( strpos( $new_version, '#' ) !== false ) {
		$new_version = substr( $new_version, 0, strpos( $new_version, '#' ) );
	}
	if ( $prev_version === $new_version ) {
		return;
	} // no upgrade

	// add burst capabilities
	if ( $prev_version
		&& version_compare( $prev_version, '1.1.1', '<' )
	) {
		burst_add_view_capability();
		burst_add_manage_capability();
	}

	if ( $prev_version
		&& version_compare( $prev_version, '1.3.0', '<' ) ) {
		if ( is_multisite() ) {
			$tour_shown = get_site_option( 'burst_tour_shown_once', false );
		} else {
			$tour_shown = get_option( 'burst_tour_shown_once', false );
		}

		if ( $tour_shown ) {
			burst_update_option( 'burst_tour_shown_once', $tour_shown );
		}
	}

	// add capability to multisite as well
	if ( is_multisite() ) {
		if ( $prev_version
			&& version_compare( $prev_version, '1.3.4', '<' )
		) {
			burst_add_view_capability();
			burst_add_manage_capability();
		}
	}

	// Version 1.3.5
	// - Upgrade to new bounce table
	// - Upgrade to remove `event` and `action` columns from `burst_statistics` table

	if ( $prev_version
		&& version_compare( $prev_version, '1.4.2.1', '<' ) ) {
		update_option( 'burst_db_upgrade_bounces', true );
		update_option( 'burst_db_upgrade_goals_remove_columns', true );
	}
	if ( $prev_version
		&& version_compare( $prev_version, '1.5.2', '<' ) ) {
		update_option( 'burst_db_upgrade_goals_set_conversion_metric', true );
	}

	if ( $prev_version
		&& version_compare( $prev_version, '1.5.3', '<' ) ) {
		update_option( 'burst_db_upgrade_strip_domain_names_from_entire_page_url', true );
		update_option( 'burst_db_upgrade_empty_referrer_when_current_domain', true );
		update_option( 'burst_db_upgrade_drop_user_agent', true );

		// remove the endpoint file from the old location
		if ( file_exists( ABSPATH . '/burst-statistics-endpoint.php' ) ) {
			unlink( ABSPATH . '/burst-statistics-endpoint.php' );
		}
	}

	if ( $prev_version
		&& version_compare( $prev_version, '1.6.0', '<' ) ) {
		BURST()->summary->restart_update_summary_table_alltime();
	}
	if ( $prev_version
		&& version_compare( $prev_version, '1.6.1', '<' ) ) {
		// add the admin to the email reports mailing list
		$mailinglist = burst_get_option( 'email_reports_mailinglist' );
		if ( ! $mailinglist ) {
			$defaults = [
				array(
					'email'     => get_option( 'admin_email' ),
					'frequency' => 'monthly',
				),
			];
			burst_update_option( 'email_reports_mailinglist', $defaults );
		}
	}

	if ( $prev_version
		&& version_compare( $prev_version, '1.6.1', '<' ) ) {
		// add the admin to the email reports mailing list
		$mailinglist = burst_get_option( 'email_reports_mailinglist' );
		if ( ! $mailinglist ) {
			$defaults = [
				array(
					'email'     => get_option( 'admin_email' ),
					'frequency' => 'monthly',
				),
			];
			burst_update_option( 'email_reports_mailinglist', $defaults );
		}
	}

	// check if column 'device_id' exists in the table 'burst_statistics'
	$is_version_upgrade      = $prev_version && version_compare( $prev_version, '1.7.0', '<' );
	$lookup_table_incomplete = version_compare( $prev_version, '1.7.1', '=' ) && ! BURST()->db_upgrade->column_exists( 'burst_statistics', 'device_id' );
	if ( $lookup_table_incomplete || $is_version_upgrade ) {
		update_option( 'burst_last_cron_hit', time(), false );
		update_option( 'burst_db_upgrade_create_lookup_tables', true, true ); // this option is used in the tracking, so should autoload until completed
		update_option( 'burst_db_upgrade_init_lookup_ids', true, false );
		update_option( 'burst_db_upgrade_upgrade_lookup_tables', true, false );
		update_option( 'burst_db_upgrade_upgrade_lookup_tables_drop_columns', true, false );

		// for each table separately, for fine grained control
		update_option( 'burst_db_upgrade_create_lookup_tables_browser', true, false );
		update_option( 'burst_db_upgrade_create_lookup_tables_browser_version', true, false );
		update_option( 'burst_db_upgrade_create_lookup_tables_platform', true, false );
		update_option( 'burst_db_upgrade_create_lookup_tables_device', true, false );
		update_option( 'burst_db_upgrade_upgrade_lookup_tables_browser', true, false );
		update_option( 'burst_db_upgrade_upgrade_lookup_tables_browser_version', true, false );
		update_option( 'burst_db_upgrade_upgrade_lookup_tables_platform', true, false );
		update_option( 'burst_db_upgrade_upgrade_lookup_tables_device', true, false );

		// drop post_meta feature
		update_option( 'burst_db_upgrade_drop_page_id_column', true, false );

		wp_schedule_single_event( time() + 300, 'burst_upgrade_iteration' );

		$mu_plugin = trailingslashit( WPMU_PLUGIN_DIR ) . 'burst_rest_api_optimizer.php';
		if ( file_exists( $mu_plugin ) ) {
			unlink( $mu_plugin );
		}
	}

	if ( $prev_version
		&& version_compare( $prev_version, '1.7.3', '<' ) ) {
		wp_clear_scheduled_hook( 'burst_every_5_minutes' );
		update_option( 'burst_db_upgrade_rename_entire_page_url_column', true, false );
		update_option( 'burst_db_upgrade_drop_path_from_parameters_column', true, false );

		wp_schedule_single_event( time() + 300, 'burst_upgrade_iteration' );
	}

    //clean up old options
    if ( $prev_version
        && version_compare( $prev_version, '1.8.0', '<' ) ) {
        $clean_up_tasks = [
            'ajax_fallback',
            'tracking-error',
            'bf_notice2024',
            'cm_notice2024',
            'new_parameters',
            'new_email_reporting',
            'leave-feedback',
            'upgrade_progress',
            'burst_geo_ip_import_error',
            'license',
            'cron',
        ];
        foreach ($clean_up_tasks as $id ) {
            delete_option( "burst_".$id."_dismissed" );
        }
        $db_version_options = [
            'burst_parameters_db_version',
            'burst_campaigns_db_version',
            'burst_stats_db_version',
            'burst_sessions_db_version',
            'burst_goals_db_version',
            'burst_goal_stats_db_version',
            'burst_archive_db_version',
        ];
        foreach ($db_version_options as $option ) {
            delete_option( $option );
        }
    }

	do_action( 'burst_upgrade', $prev_version );
	update_option( 'burst-current-version', $new_version, false );
}
