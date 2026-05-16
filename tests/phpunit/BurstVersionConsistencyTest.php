<?php
use PHPUnit\Framework\TestCase;

class BurstVersionConsistencyTest extends TestCase {

    /**
     * Verifies that the "Tested up to" version in the free plugin's readme.txt is
     * greater than or equal to the latest WordPress release when ignoring patch
     * versions. The free repo only requires a major.minor match, so "Tested up to: 6.9"
     * covers all 6.9.x releases. A warning only appears when the major.minor of the
     * latest WP version exceeds the tested up to value.
     */
    public function test_free_tested_up_to_version() {
        $plugin_dir = dirname( __FILE__, 3 );
        $readme_path = $plugin_dir . '/readme.txt';

        // Get "Tested up to" from free readme.txt
        $tested_up_to = $this->get_tested_up_to( $readme_path );
        $this->assertNotNull( $tested_up_to, 'Could not find "Tested up to" in readme.txt' );

        // Fetch latest WordPress version from the official API
        $response = file_get_contents( 'https://api.wordpress.org/core/version-check/1.7/' );
        $this->assertNotFalse( $response, 'Could not fetch WordPress version from API' );

        $data = json_decode( $response, true );
        $this->assertNotNull( $data, 'Could not parse WordPress version API response' );

        $latest_wp_version = $data['offers'][0]['version'] ?? null;
        $this->assertNotNull( $latest_wp_version, 'Could not find version in WordPress API response' );

        // Strip patch version from both values, leaving only major.minor (e.g. 6.9.1 -> 6.9)
        $tested_up_to_normalized  = $this->normalize_to_minor( $tested_up_to );
        $latest_wp_normalized     = $this->normalize_to_minor( $latest_wp_version );

        // Tested up to major.minor must be >= latest WP major.minor
        $this->assertGreaterThanOrEqual(
            0,
            version_compare( $tested_up_to_normalized, $latest_wp_normalized ),
            "\"Tested up to\" ($tested_up_to) must be greater than or equal to the latest WordPress major.minor version ($latest_wp_normalized)."
        );
    }

    private function normalize_to_minor( string $version ): string {
        $parts = explode( '.', $version );

        // Return only major.minor (first two segments)
        return implode( '.', array_slice( $parts, 0, 2 ) );
    }

    private function get_tested_up_to( string $file_path ): ?string {
        if ( ! file_exists( $file_path ) ) {
            return null;
        }

        $content = file_get_contents( $file_path );
        if ( preg_match( '/^Tested up to:\s*(\d+\.\d+(?:\.\d+)?)/mi', $content, $matches ) ) {
            return $matches[1];
        }

        return null;
    }

    public function test_version_consistency() {
        $plugin_dir = dirname( __FILE__, 3 );

        // Get version from readme.txt
        $readme_version = $this->get_readme_version( $plugin_dir . '/readme.txt' );

        // Get version from burst.php
        $plugin_version = $this->get_plugin_version( $plugin_dir . '/burst.php' );

        // Get version from includes/class-burst.php
        $class_version = $this->get_class_version( $plugin_dir . '/includes/class-burst.php' );

        // Assert all versions are found
        $this->assertNotNull( $readme_version, 'Could not find version in readme.txt' );
        $this->assertNotNull( $plugin_version, 'Could not find version in burst.php' );
        $this->assertNotNull( $class_version, 'Could not find version in includes/class-burst.php' );

        // Assert all versions match
        $this->assertEquals(
            $readme_version,
            $plugin_version,
            "Version mismatch: readme.txt ($readme_version) vs burst.php ($plugin_version)"
        );

        $this->assertEquals(
            $readme_version,
            $class_version,
            "Version mismatch: readme.txt ($readme_version) vs class-burst.php ($class_version)"
        );

        $this->assertEquals(
            $plugin_version,
            $class_version,
            "Version mismatch: burst.php ($plugin_version) vs class-burst.php ($class_version)"
        );
    }

    public function test_version_format() {
        $plugin_dir = dirname( __FILE__, 3 );

        $readme_version = $this->get_readme_version( $plugin_dir . '/readme.txt' );
        $plugin_version = $this->get_plugin_version( $plugin_dir . '/burst.php' );
        $class_version = $this->get_class_version( $plugin_dir . '/includes/class-burst.php' );

        // Test that versions match either x.x.x or x.x.x.x format
        $valid_format = '/^\d+\.\d+\.\d+(?:\.\d+)?$/';

        $this->assertMatchesRegularExpression( $valid_format, $readme_version, 'readme.txt version has invalid format' );
        $this->assertMatchesRegularExpression( $valid_format, $plugin_version, 'burst.php version has invalid format' );
        $this->assertMatchesRegularExpression( $valid_format, $class_version, 'class-burst.php version has invalid format' );
    }

    public function test_changelog_structure() {
        $plugin_dir = dirname( __FILE__, 3 );
        $readme_path = $plugin_dir . '/readme.txt';

        $this->assertFileExists( $readme_path, 'readme.txt file not found' );

        $readme_version = $this->get_readme_version( $readme_path );
        $this->assertNotNull( $readme_version, 'Could not find stable tag version in readme.txt' );

        $content = file_get_contents( $readme_path );

        // Find the changelog section for the current version
        $changelog_entry = $this->get_changelog_entry( $content, $readme_version );

        $this->assertNotNull(
            $changelog_entry,
            "Changelog entry not found for version $readme_version"
        );

        // Check if changelog has a date
        $has_date = $this->changelog_has_date( $changelog_entry );
        $this->assertTrue(
            $has_date,
            "Changelog for version $readme_version is missing a date. Found content:\n" . $changelog_entry
        );

        // Check if changelog has at least one change line
        $change_count = $this->count_changelog_changes( $changelog_entry );
        $this->assertGreaterThan(
            0,
            $change_count,
            "Changelog for version $readme_version must have at least one change entry (Fix, Improvement, New, or Security)"
        );
    }

    private function get_readme_version( string $file_path ): ?string {
        if ( ! file_exists( $file_path ) ) {
            return null;
        }

        $content = file_get_contents( $file_path );
        if ( preg_match( '/^Stable tag:\s*(\d+\.\d+\.\d+(?:\.\d+)?)/m', $content, $matches ) ) {
            return $matches[1];
        }

        return null;
    }

    private function get_plugin_version( string $file_path ): ?string {
        if ( ! file_exists( $file_path ) ) {
            return null;
        }

        $content = file_get_contents( $file_path );
        if ( preg_match( '/\*\s*Version:\s*(\d+\.\d+\.\d+(?:\.\d+)?)/i', $content, $matches ) ) {
            return $matches[1];
        }

        return null;
    }

    private function get_class_version( string $file_path ): ?string {
        if ( ! file_exists( $file_path ) ) {
            return null;
        }

        $content = file_get_contents( $file_path );
        if ( preg_match( '/define\s*\(\s*[\'"]BURST_VERSION[\'"]\s*,\s*[\'"](\d+\.\d+\.\d+(?:\.\d+)?)[\'"]/', $content, $matches ) ) {
            return $matches[1];
        }

        return null;
    }

    private function get_changelog_entry( string $content, string $version ): ?string {
        // Escape dots in version for regex
        $version_escaped = preg_quote( $version, '/' );

        // Match the version header and everything until the next version or end of changelog
        // Updated to handle both = format and potential whitespace variations
        $pattern = '/^=+\s*' . $version_escaped . '\s*=+\s*\n(.*?)(?=\n=+\s*\d+\.\d+\.\d+(?:\.\d+)?\s*=+|\z)/ms';

        if ( preg_match( $pattern, $content, $matches ) ) {
            return trim( $matches[1] );
        }

        return null;
    }

    private function changelog_has_date( string $changelog_entry ): bool {
        // Check for date patterns - more flexible patterns
        $date_patterns = [
            // Month name with day number (with or without asterisk, case insensitive)
            '/[\*\s]*(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(st|nd|rd|th)?/i',
            // ISO date format
            '/\d{4}-\d{2}-\d{2}/',
            // Common date formats
            '/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/',
        ];

        foreach ( $date_patterns as $pattern ) {
            if ( preg_match( $pattern, $changelog_entry ) ) {
                return true;
            }
        }

        return false;
    }

    private function count_changelog_changes( string $changelog_entry ): int {
        // Count lines that start with * followed by Fix, Improvement, New, or Security
        $pattern = '/^\*\s*(Fix|Improvement|New|Security):/m';

        preg_match_all( $pattern, $changelog_entry, $matches );

        return count( $matches[0] );
    }

    /**
     * Verifies that class-upgrade.php contains an upgrade block for the current plugin
     * version. The last `version_compare( $prev_version, 'X.Y.Z', '<' )` in the file must
     * reference the current version so that bumping the plugin version forces the developer
     * to consciously decide whether an upgrade routine is needed.
     *
     * The block may either contain real upgrade code or just a comment explaining that no
     * upgrade is needed — but the block must exist and must not be empty. Multiple blocks
     * for the same version are flagged as duplicates so they can be merged.
     */
    public function test_upgrade_class_has_current_version_block() {
        $plugin_dir   = dirname( __FILE__, 3 );
        $upgrade_path = $plugin_dir . '/includes/Admin/class-upgrade.php';

        $this->assertFileExists( $upgrade_path, 'class-upgrade.php not found' );

        $current_version = $this->get_plugin_version( $plugin_dir . '/burst.php' );
        $this->assertNotNull( $current_version, 'Could not find current plugin version' );

        $content = file_get_contents( $upgrade_path );

        // Find all `version_compare( $prev_version, 'X.Y.Z', '<' )` calls in file order.
        $pattern = '/version_compare\s*\(\s*\$prev_version\s*,\s*[\'"]([^\'"]+)[\'"]\s*,\s*[\'"]<[\'"]\s*\)/';
        preg_match_all( $pattern, $content, $matches );

        $versions = $matches[1];
        $this->assertNotEmpty( $versions, 'No version_compare( $prev_version, ..., \'<\' ) calls found in class-upgrade.php' );

        $errors = [];

        // 1. The textually last version_compare must be for the current plugin version.
        $last_version = end( $versions );
        if ( version_compare( $last_version, $current_version, '!=' ) ) {
            $errors[] = sprintf(
                'The last version_compare in class-upgrade.php is for version %s, but the current plugin version is %s. Add an if-block for %s as the last upgrade block (with code if an upgrade is needed, or a comment stating no upgrade is needed).',
                $last_version,
                $current_version,
                $current_version
            );
        }

        // 2. No version_compare may reference a version above the current plugin version.
        $above_current = array_values( array_unique( array_filter(
            $versions,
            static fn( $v ) => version_compare( $v, $current_version, '>' )
        ) ) );
        if ( ! empty( $above_current ) ) {
            $errors[] = sprintf(
                'class-upgrade.php contains version_compare blocks for version(s) higher than the current plugin version (%s): %s. Either bump the plugin version or remove these blocks.',
                $current_version,
                implode( ', ', $above_current )
            );
        }

        // 3. Flag duplicate versions so they can be merged.
        $counts     = array_count_values( $versions );
        $duplicates = array_keys( array_filter( $counts, static fn( $c ) => $c > 1 ) );
        if ( ! empty( $duplicates ) ) {
            $errors[] = 'Duplicate version_compare blocks found for version(s): ' . implode( ', ', $duplicates ) . '. Merge them into a single upgrade block.';
        }

        // 4. The if-block for the current version must have a non-empty body
        //    (either real code or at least a comment stating no upgrade is needed).
        $block_body = $this->get_upgrade_block_body( $content, $current_version );
        if ( $block_body === null ) {
            $errors[] = sprintf(
                'No if-block found that uses version_compare( $prev_version, \'%s\', \'<\' ). Add one at the end of check_upgrade().',
                $current_version
            );
        } elseif ( trim( $block_body ) === '' ) {
            $errors[] = sprintf(
                'The if-block for version %s is empty. Add at least one line of code, or a comment stating that no upgrade is needed for this version.',
                $current_version
            );
        }

        $this->assertEmpty(
            $errors,
            "class-upgrade.php consistency issues:\n - " . implode( "\n - ", $errors )
        );
    }

    /**
     * Returns the textual body of the first if-block whose condition uses
     * `version_compare( $prev_version, $version, '<' )`. Braces are balanced manually so
     * that nested blocks inside the body don't terminate the match early. Returns null when
     * no such if-block exists.
     */
    private function get_upgrade_block_body( string $content, string $version ): ?string {
        $version_escaped = preg_quote( $version, '/' );
        $pattern         = '/if\s*\(\s*[^{]*?version_compare\s*\(\s*\$prev_version\s*,\s*[\'"]' . $version_escaped . '[\'"]\s*,\s*[\'"]<[\'"]\s*\)[^{]*?\)\s*\{/';

        if ( ! preg_match( $pattern, $content, $matches, PREG_OFFSET_CAPTURE ) ) {
            return null;
        }

        $start = $matches[0][1] + strlen( $matches[0][0] );
        $depth = 1;
        $len   = strlen( $content );

        for ( $i = $start; $i < $len; $i++ ) {
            $ch = $content[ $i ];
            if ( $ch === '{' ) {
                ++$depth;
            } elseif ( $ch === '}' ) {
                --$depth;
                if ( $depth === 0 ) {
                    return substr( $content, $start, $i - $start );
                }
            }
        }

        return null;
    }
}