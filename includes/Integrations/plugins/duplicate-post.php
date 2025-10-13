<?php
/**
 * Burst Pro - Integrations Test for CI Environment
 */
if ( defined( 'BURST_CI_ACTIVE' ) ) {
	add_action(
		'init',
		function (): void {
			// intentionally added log here for the test.
            // phpcs:ignore
            error_log('Burst - Yoast Duplicate Post integration loaded in CI environment INIT.');
		},
		20
	);
}
