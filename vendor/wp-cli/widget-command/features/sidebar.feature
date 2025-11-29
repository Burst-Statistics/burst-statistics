Feature: Manage WordPress sidebars

  Scenario: List available sidebars
    Given a WP install

    When I try `wp theme delete twentytwelve --force`
    And I run `wp theme install twentytwelve --activate`
    Then STDOUT should not be empty

    When I run `wp sidebar list --fields=name,id`
    Then STDOUT should be a table containing rows:
      | name                          | id                  |
      | Main Sidebar                  | sidebar-1           |
      | First Front Page Widget Area  | sidebar-2           |
      | Second Front Page Widget Area | sidebar-3           |
      | Inactive Widgets              | wp_inactive_widgets |

    When I run `wp sidebar list --format=ids`
    Then STDOUT should be:
    """
    sidebar-1 sidebar-2 sidebar-3 wp_inactive_widgets
    """

    When I run `wp sidebar list --format=count`
    Then STDOUT should be:
    """
    4
    """
