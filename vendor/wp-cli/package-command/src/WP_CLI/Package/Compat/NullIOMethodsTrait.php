<?php

namespace WP_CLI\Package\Compat;

use Composer\InstalledVersions;
use Composer\Semver\VersionParser;

// phpcs:disable Generic.Files.OneObjectStructurePerFile.MultipleFound,Generic.Classes.DuplicateClassName.Found

if (
	class_exists( InstalledVersions::class )
	&& InstalledVersions::satisfies( new VersionParser(), 'composer/composer', '^2.3' )
) {
	require_once __DIR__ . '/Min_Composer_2_3/NullIOMethodsTrait.php';

	trait NullIOMethodsTrait {

		use Min_Composer_2_3\NullIOMethodsTrait;
	}

	return;
}

require_once __DIR__ . '/Min_Composer_1_10/NullIOMethodsTrait.php';

trait NullIOMethodsTrait {

	use Min_Composer_1_10\NullIOMethodsTrait;
}
