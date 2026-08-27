<?php
use PHPUnit\Framework\TestCase;

/**
 * Guards that the CI Docker image in .gitlab-ci.yml keeps tracking the newest
 * playwright-e2e image available in the container registry.
 *
 * Images are built daily by the playwright-e2e project (ci/check-versions.sh)
 * for the latest WordPress production release (`auto-php-<php>-wp-<x.y.z>`)
 * and for the first RC of an upcoming version (`auto-php-<php>-wp-<x.y.z>-RC`,
 * no RC number). Manually pushed images use the same tag format without the
 * `auto-` prefix; both are recognized and compared purely on their versions.
 * This test lists the tags in the registry and fails when a newer
 * image exists than the newest one referenced in .gitlab-ci.yml — so both a
 * new stable release image and a new RC image require a bump. Jobs that pin an
 * intentionally old image (e.g. wp-6.6.0 for lowest-supported-version tests)
 * are ignored: only the newest referenced tag is compared.
 *
 * The registry is private, so the tag list is fetched with the CI job token.
 * Without a token (local runs) the test is skipped; in CI a failing registry
 * request fails the test so a broken guard cannot go unnoticed.
 */
class BurstCiImageVersionTest extends TestCase {

	private const GITLAB_HOST   = 'source.updraftplus.com';
	private const REGISTRY_HOST = 'source.updraftplus.com:5050';
	private const IMAGE_PATH    = 'ci/playwright-e2e';

	public function test_ci_image_uses_latest_playwright_image() {
		$yml_path = dirname( __FILE__, 3 ) . '/.gitlab-ci.yml';
		$this->assertFileExists( $yml_path, '.gitlab-ci.yml not found' );

		$used = $this->get_newest_used_tag( $yml_path );
		$this->assertNotNull(
			$used,
			'Could not find any playwright-e2e image tag in .gitlab-ci.yml'
		);

		$tags = $this->list_registry_tags();
		if ( $tags === null ) {
			$this->markTestSkipped(
				'No CI_JOB_TOKEN available to list the playwright-e2e registry tags; run in CI to check the image version.'
			);
		}

		$available = $this->newest_tag( $tags );
		$this->assertNotNull(
			$available,
			'No playwright-e2e image tags matching php-<php>-wp-<version> found in the registry.'
		);

		$this->assertFalse(
			$this->compare_tags( $used, $available ) < 0,
			sprintf(
				'A newer playwright-e2e image is available: %s (newest tag used in .gitlab-ci.yml is %s). ' .
				'Update the playwright-e2e image tags in .gitlab-ci.yml to %s.',
				$available['tag'],
				$used['tag'],
				$available['tag']
			)
		);
	}

	private function get_newest_used_tag( string $file_path ): ?array {
		$content = file_get_contents( $file_path );
		if ( $content === false ) {
			return null;
		}

		if ( ! preg_match_all( '/playwright-e2e:((?:auto-)?php-[0-9][0-9.]*-wp-[0-9][0-9.]*(?:-[A-Za-z0-9.]+)?)/', $content, $matches ) ) {
			return null;
		}

		return $this->newest_tag( array_unique( $matches[1] ) );
	}

	private function newest_tag( array $tags ): ?array {
		$parsed = array_values( array_filter( array_map( [ $this, 'parse_tag' ], $tags ) ) );
		if ( $parsed === [] ) {
			return null;
		}

		usort( $parsed, [ $this, 'compare_tags' ] );

		return end( $parsed );
	}

	/**
	 * Parses `[auto-]php-<php>-wp-<wp>[-<prerelease>]` into comparable parts.
	 * The wp base is normalized to x.y.z (registry tags always use x.y.z, but
	 * older references may use x.y) so version_compare orders tags correctly —
	 * a `-RC` suffix sorts below the stable build of the same version. The
	 * `auto-` prefix marks daily-built images and is ignored for comparison.
	 */
	private function parse_tag( string $tag ): ?array {
		if ( ! preg_match( '/^(?:auto-)?php-([0-9]+(?:\.[0-9]+)*)-wp-([0-9]+(?:\.[0-9]+){0,2})(-[A-Za-z0-9.]+)?$/', $tag, $matches ) ) {
			return null;
		}

		$wp = $matches[2];
		while ( substr_count( $wp, '.' ) < 2 ) {
			$wp .= '.0';
		}

		return [
			'tag' => $tag,
			'php' => $matches[1],
			'wp'  => $wp . ( $matches[3] ?? '' ),
		];
	}

	private function compare_tags( array $a, array $b ): int {
		$by_wp = version_compare( $a['wp'], $b['wp'] );
		if ( $by_wp !== 0 ) {
			return $by_wp;
		}

		return version_compare( $a['php'], $b['php'] );
	}

	private function list_registry_tags(): ?array {
		$job_token = getenv( 'CI_JOB_TOKEN' );
		if ( ! is_string( $job_token ) || $job_token === '' ) {
			return null;
		}

		$bearer = $this->get_registry_bearer_token( $job_token );
		if ( $bearer === null ) {
			$this->fail(
				'Could not authenticate against the playwright-e2e container registry with CI_JOB_TOKEN. ' .
				'Ensure this project is allowed in the playwright-e2e job token allowlist (Settings → CI/CD → Job token permissions).'
			);
		}

		$response = $this->http_get(
			'https://' . self::REGISTRY_HOST . '/v2/' . self::IMAGE_PATH . '/tags/list',
			[ 'Authorization: Bearer ' . $bearer ]
		);
		if ( $response === null ) {
			$this->fail( 'Could not list the playwright-e2e container registry tags.' );
		}

		$data = json_decode( $response, true );
		$tags = $data['tags'] ?? null;
		if ( ! is_array( $tags ) ) {
			$this->fail( 'Unexpected response from the playwright-e2e container registry tag list.' );
		}

		return $tags;
	}

	private function get_registry_bearer_token( string $job_token ): ?string {
		$response = $this->http_get(
			'https://' . self::GITLAB_HOST . '/jwt/auth?service=container_registry&scope=repository:' . self::IMAGE_PATH . ':pull',
			[ 'Authorization: Basic ' . base64_encode( 'gitlab-ci-token:' . $job_token ) ]
		);
		if ( $response === null ) {
			return null;
		}

		$data  = json_decode( $response, true );
		$token = $data['token'] ?? null;

		return is_string( $token ) ? $token : null;
	}

	private function http_get( string $url, array $headers ): ?string {
		$context = stream_context_create(
			[
				'http' => [
					'method'  => 'GET',
					'header'  => implode( "\r\n", $headers ),
					'timeout' => 15,
				],
			]
		);

		$response = @file_get_contents( $url, false, $context );

		return $response === false ? null : $response;
	}
}
