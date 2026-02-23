<?php

namespace Burst\Admin\Data_Sharing\Data_Collectors;

abstract class Data_Collector {

	/**
	 * Collect data
	 */
	abstract public function collect_data(): array;
}
