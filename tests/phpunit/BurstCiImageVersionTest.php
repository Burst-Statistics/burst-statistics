<?php
use PHPUnit\Framework\TestCase;

/**
 * Guards that the newest WordPress version referenced by the CI Docker images in
 * .gitlab-ci.yml keeps tracking the latest WordPress release.
 *
 * The playwright-e2e images are tagged as `...:php-<php>-wp-<wp>`. Some jobs pin an
 * intentionally old WordPress (e.g. wp-6.6.0) to test the lowest supported version —
 * those are ignored here. Only the highest wp-<version> across all image tags is
 * checked, and it must stay current:
 *
 *   - A pre-release tag (e.g. wp-7.0-beta1) fails once the stable release of that line
 *     (7.0) is out: the image should switch from the beta to the stable build.
 *   - A stable tag (e.g. wp-7.0) fails once a newer major.minor line (7.1) is available.
 *     Patch releases within the same line (7.0 vs 7.0.1) are ignored.
 */
class BurstCiImageVersionTest extends TestCase {

	public function test_ci_image_uses_latest_wordpress() {
		$yml_path = dirname( __FILE__, 3 ) . '/.gitlab-ci.yml';
		$this->assertFileExists( $yml_path, '.gitlab-ci.yml not found' );

		$highest = $this->get_highest_ci_wp_version( $yml_path );
		$this->assertNotNull(
			$highest,
			'Could not find any playwright-e2e wp-<version> image tag in .gitlab-ci.yml'
		);

		$latest_stable = $this->get_latest_wordpress_version();
		if ( $latest_stable === null ) {
			$this->markTestSkipped( 'Could not reach the WordPress.org version API.' );
		}

		if ( $this->is_prerelease( $highest ) ) {
			$base = $this->base_version( $highest );
			$this->assertTrue(
				version_compare( $latest_stable, $base, '<' ),
				sprintf(
					'CI image uses pre-release WordPress %s, but stable %s has been released. ' .
					'Update the playwright-e2e image tags in .gitlab-ci.yml to wp-%s.',
					$highest,
					$latest_stable,
					$latest_stable
				)
			);

			return;
		}

		$this->assertFalse(
			version_compare( $this->major_minor( $highest ), $this->major_minor( $latest_stable ), '<' ),
			sprintf(
				'CI image uses WordPress %s, but %s is available. ' .
				'Update the playwright-e2e image tags in .gitlab-ci.yml to wp-%s.',
				$highest,
				$latest_stable,
				$latest_stable
			)
		);
	}

	private function get_highest_ci_wp_version( string $file_path ): ?string {
		$content = file_get_contents( $file_path );
		if ( $content === false ) {
			return null;
		}

		$pattern = '/playwright-e2e:php-[0-9.]+-wp-([0-9]+\.[0-9]+(?:\.[0-9]+)?(?:-[a-zA-Z0-9.]+)?)/';
		if ( ! preg_match_all( $pattern, $content, $matches ) ) {
			return null;
		}

		$versions = array_values( array_unique( $matches[1] ) );
		usort(
			$versions,
			static fn( $a, $b ) => version_compare( $a, $b )
		);

		return end( $versions ) ?: null;
	}

	private function get_latest_wordpress_version(): ?string {
		$response = @file_get_contents( 'https://api.wordpress.org/core/version-check/1.7/' );
		if ( $response === false ) {
			return null;
		}

		$data = json_decode( $response, true );
		$version = $data['offers'][0]['version'] ?? null;

		return is_string( $version ) ? $version : null;
	}

	private function is_prerelease( string $version ): bool {
		return (bool) preg_match( '/-(?:alpha|beta|rc)/i', $version );
	}

	private function base_version( string $version ): string {
		return preg_replace( '/-.*$/', '', $version );
	}

	private function major_minor( string $version ): string {
		$parts = explode( '.', $this->base_version( $version ) );

		return $parts[0] . '.' . ( $parts[1] ?? '0' );
	}
}
