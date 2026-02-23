<?php
defined( 'ABSPATH' ) || die();

return [
	[
		'id'       => 'email_reports_mailinglist',
		'menu_id'  => 'reports',
		'group_id' => 'reports',
		'type'     => 'email_reports',
		'label'    => __( 'Email reports', 'burst-statistics' ),
		'disabled' => false,
		'default'  => '',
	],
	[
		'id'       => 'logo_attachment_id',
		'menu_id'  => 'customization',
		'group_id' => 'customization',
		'type'     => 'logo_editor',
		'label'    => __( 'Change logo in the email reports', 'burst-statistics' ),
		'context'  => __( 'Recommended size is 200 pixels by 70 pixels and try to keep the filesize under 200 kb.', 'burst-statistics' ),
		'pro'      => [
			'url' => 'pricing/',
		],
		'disabled' => false,
		'default'  => false,
	],
	[
		'id'       => 'report_logs',
		'menu_id'  => 'logs',
		'group_id' => 'logs',
		'type'     => 'report_logs',
		'label'    => __( 'Email report logs', 'burst-statistics' ),
		'context'  => __( 'View detailed logs for sent email reports, including delivery status, errors, and cron execution results.', 'burst-statistics' ),
		'disabled' => false,
		'default'  => false,
	],
];
