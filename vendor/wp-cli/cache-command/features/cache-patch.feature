Feature: Patch command available for the object cache

  Scenario: Nested values from cache can be updated at any depth.
    Given a WP install
    And a wp-content/mu-plugins/test-harness.php file:
      """php
      <?php
      $set_foo = function(){
        wp_cache_set( 'my_key', ['foo' => 'bar'] );
        wp_cache_set( 'other_key', ['fuz' => 'biz'] );

        $complex_key = (object) [
            'foo' => (object) [
                'bar' => (object) [
                    'baz' => 2,
                ],
            ],
        ];
        wp_cache_set( 'complex_key', $complex_key );
      };

      WP_CLI::add_hook( 'before_invoke:cache patch', $set_foo );
      """

    When I run `wp cache patch insert my_key fuz baz`
    Then STDOUT should be:
      """
      Success: Updated cache key 'my_key'.
      """

    When I run `wp cache patch insert complex_key foo bar fuz 34`
    Then STDOUT should be:
      """
      Success: Updated cache key 'complex_key'.
      """

    When I try `wp cache patch insert unknown_key foo bar`
    Then STDERR should be:
      """
      Error: Cannot create key "foo" on data type boolean
      """

    When I run `wp cache patch update my_key foo test`
    Then STDOUT should be:
      """
      Success: Updated cache key 'my_key'.
      """

    When I run `wp cache patch update other_key fuz biz`
    Then STDOUT should be:
      """
      Success: Value passed for cache key 'other_key' is unchanged.
      """

    When I run `wp cache patch update complex_key foo bar baz 34`
    Then STDOUT should be:
      """
      Success: Updated cache key 'complex_key'.
      """

    When I try `wp cache patch update unknown_key foo test`
    Then STDERR should be:
      """
      Error: No data exists for key "foo"
      """

    When I try `wp cache patch update my_key bar test`
    Then STDERR should be:
      """
      Error: No data exists for key "bar"
      """

    When I run `wp cache patch delete my_key foo`
    Then STDOUT should be:
      """
      Success: Updated cache key 'my_key'.
      """

    When I try `wp cache patch delete unknown_key foo`
    Then STDERR should be:
      """
      Error: No data exists for key "foo"
      """

    When I try `wp cache patch delete my_key bar`
    Then STDERR should be:
      """
      Error: No data exists for key "bar"
      """
