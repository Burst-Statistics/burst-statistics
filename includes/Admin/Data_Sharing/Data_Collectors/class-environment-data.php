<?php

namespace Burst\Admin\Data_Sharing\Data_Collectors;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Burst\Traits\Helper;

/**
 * Class Environment_Data
 */
class Environment_Data extends Data_Collector {
	use Helper;

	/**
	 * Collect data from the settings
	 */
	public function collect_data(): array {
		return [
			'wordpress' => [
				'version' => wp_get_wp_version(),
			],
			'php'       => [
				'version' => phpversion(),
			],
			'plugins'   => [
				'active_plugins' => get_option( 'active_plugins', [] ),
			],
		];
	}
}
