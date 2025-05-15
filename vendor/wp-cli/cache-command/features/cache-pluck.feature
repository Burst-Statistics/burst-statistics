Feature: Pluck command available for the object cache

  Scenario: Nested values from cache can be retrieved at any depth.
    Given a WP install
    And a wp-content/mu-plugins/test-harness.php file:
      """php
      <?php
      $set_foo = function(){
        wp_cache_set( 'my_key', ['foo' => 'bar'] );
        wp_cache_set( 'my_key_2', ['foo' => ['bar' => 'baz']] );
        wp_cache_set( 'my_key_3', ['foo' => 'bar_custom'], 'my_custom_group' );
      };

      WP_CLI::add_hook( 'before_invoke:cache pluck', $set_foo );
      """

    When I run `wp cache pluck my_key foo`
    Then STDOUT should be:
      """
      bar
      """

    When I run `wp cache pluck my_key_2 foo bar`
    Then STDOUT should be:
      """
      baz
      """

    When I run `wp cache pluck my_key_3 foo --group=my_custom_group`
    Then STDOUT should be:
      """
      bar_custom
      """

    When I try `wp cache pluck unknown_key test`
    Then STDERR should be:
      """
      Warning: No object found for the key 'unknown_key' in group 'default'
      """

