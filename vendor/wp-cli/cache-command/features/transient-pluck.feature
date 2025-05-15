Feature: Pluck command available for the transient cache

  Scenario: Nested values from transient can be retrieved at any depth.
    Given a WP install
    And I run `wp eval "set_transient( 'my_key', ['foo' => 'bar'] );"`
    And I run `wp eval "set_transient( 'my_key_2', ['foo' => ['bar' => 'baz']] );"`

    When I run `wp transient pluck my_key foo`
    Then STDOUT should be:
      """
      bar
      """

    When I run `wp transient pluck my_key_2 foo bar`
    Then STDOUT should be:
      """
      baz
      """

    When I try `wp transient pluck unknown_key foo`
    Then STDERR should be:
      """
      Warning: Transient with key "unknown_key" is not set.
      """

  Scenario: Nested values from site transient can be retrieved at any depth.
    Given a WP multisite install
    And I run `wp eval "set_site_transient( 'my_key', ['foo' => 'bar'] );"`
    And I run `wp eval "set_site_transient( 'my_key_2', ['foo' => ['bar' => 'baz']] );"`

    When I run `wp transient pluck my_key foo --network`
    Then STDOUT should be:
      """
      bar
      """

    When I run `wp transient pluck my_key_2 foo bar --network`
    Then STDOUT should be:
      """
      baz
      """

    When I try `wp transient pluck unknown_key foo --network`
    Then STDERR should be:
      """
      Warning: Transient with key "unknown_key" is not set.
      """
