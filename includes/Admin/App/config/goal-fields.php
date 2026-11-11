<?php
defined( 'ABSPATH' ) || die();

// The goal types the server accepts. Labels and the other wizard options live in the dashboard (goalOptions.ts).
return [
	[
		'id'      => 'type',
		'options' => [
			'clicks' => [],
			'views'  => [],
			'visits' => [
				'server_side' => true,
			],
			'hook'   => [
				'server_side' => true,
			],
		],
	],
];
