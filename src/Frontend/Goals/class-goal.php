<?php
namespace Burst\Frontend\Goals;

use Burst\Admin\App\Fields\Fields;
use Burst\Traits\Admin_Helper;
use Burst\Traits\Helper;
use Burst\Traits\Sanitize;

class Goal {
	use Admin_Helper;
	use Helper;
	use Sanitize;

	public $id;
	public $title             = '';
	public $type              = 'clicks';
	public $status            = 'inactive';
	public $server_side       = false;
	public $url               = '*';
	public $conversion_metric = 'visitors';
	public $date_start;
	public $date_end;
	public $date_created;

    //phpcs:ignore
	public $setup;// deprecated.
    //phpcs:ignore
    public $attribute; // deprecated since 2.0.0.
    //phpcs:ignore
    public $attribute_value; // deprecated since 2.0.0.

	/**
	 * Selector, id or class, for the goal.
	 *
	 * @var string
	 */
	public $selector        = '';
	public $hook            = '';
	public $page_or_website = 'website';
	public $specific_page   = '';
	/**
	 * Constructor
	 */
	public function __construct( int $id = 0 ) {
		$this->id = $id;
		$this->get();
	}

    // phpcs:disable
    /**
	 * Retrieve a property value
	 */
    public function __get( string $property ) {
		if ( property_exists( $this, $property ) ) {
			return $this->$property;
		}
		return false;
	}


	/**
	 * Set a property value
	 */
	public function __set( string $property, $value ): void {
		if ( property_exists( $this, $property ) ) {
			$this->$property = $value;
		}
	}
    // phpcs:enable
	/**
	 * Get the goal object, with values if an id is provided
	 */
	private function get( bool $upgrade = true ): Goal {
		global $wpdb;
		$goal = wp_cache_get( 'burst_goal_' . $this->id, 'burst' );
		if ( ! $goal ) {
			$goal = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}burst_goals WHERE ID = %s", $this->id ) );
			wp_cache_set( 'burst_goal_' . $this->id, $goal, 'burst', 10 );
		}

		if ( $goal ) {
			$this->title             = $goal->title !== '' ? $goal->title : __( 'New goal', 'burst-statistics' );
			$this->type              = $goal->type;
			$this->status            = $goal->status;
			$this->server_side       = $this->type === 'hook' || $this->type === 'visits';
			$this->url               = $goal->url;
			$this->conversion_metric = $goal->conversion_metric;
			if ( isset( $goal->attribute ) ) {
				// deprecated since 2.0.0.
				$this->attribute = empty( $goal->attribute ) ? null : $goal->attribute;
			}
			if ( isset( $goal->attribute_value ) ) {
				// deprecated since 2.0.0.
				$this->attribute_value = empty( $goal->attribute_value ) ? null : $goal->attribute_value;
			}
			$this->selector   = empty( $goal->selector ) ? '' : $goal->selector;
			$this->hook       = empty( $goal->hook ) ? '' : $goal->hook;
			$this->date_start = $goal->date_start;
			// $goal->date_end > 0 ? $goal->date_end : strtotime( 'tomorrow midnight' ) - 1;.
			$this->date_end     = 0;
			$this->date_created = $goal->date_created;

			// Split url property into two separate properties, depending on * value.
			$this->page_or_website = $this->url !== '*' ? 'page' : 'website';
			$this->specific_page   = $this->page_or_website === 'page' ? $this->url : '';

			// Upgrade old structure data, then remove it.
			$setup = isset( $goal->setup ) ? json_decode( $goal->setup, false ) : null;
			if ( $upgrade && $setup !== null && isset( $setup->attribute ) && isset( $setup->value ) ) {
				$this->selector = $setup->attribute === 'id' ? '#' . $setup->value : '.' . $setup->value;
				$this->setup    = null;
				$this->save();
			}
		}
		return $this;
	}

	/**
	 * Save a goal
	 *
	 * @return bool True on success, false on failure
	 */
	public function save(): bool {
		do_action( 'burst_before_save_goals', $this );
		global $wpdb;
		$table_name = $wpdb->prefix . 'burst_goals';

		// Validate required fields.
		if ( empty( $this->title ) ) {
			$this->title = __( 'New goal', 'burst-statistics' );
		}

		$available_goal_types = $this->get_available_goal_fields();
		// Merge url property from two separate properties, depending on 'website' value.
		$url       = $this->page_or_website === 'website' ? '*' : $this->specific_page;
		$this->url = $url !== '*' ? $this->sanitize_relative_url( $url ) : '*';

		// Validate goal type exists.
		if ( ! isset( $available_goal_types[ $this->type ] ) ) {
			return false;
		}

		$this->server_side       = $available_goal_types[ $this->type ]['server_side'] ?? 0;
		$this->conversion_metric = $this->sanitize_goal_conversion_metric( $this->conversion_metric );

		// Update start time only if the goal status has changed to active, or if it's a new goal.
		$db_goal = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}burst_goals WHERE ID = %s", $this->id ) );
		if ( $db_goal ) {
			if ( $db_goal->status !== $this->status && $this->status === 'active' ) {
				$this->date_start = time();
				$this->date_end   = 0;
			}
		} else {
			$this->date_start = time();
			$this->date_end   = 0;
		}

		$args = [
			'title'             => sanitize_text_field( $this->title ),
			'type'              => $this->type,
			'status'            => $this->sanitize_status( $this->status ),
			'url'               => $this->url,
			'conversion_metric' => $this->conversion_metric,
			'date_start'        => $this->date_start,
			'date_end'          => $this->date_end,
			'date_created'      => (int) $this->date_created,
			'selector'          => sanitize_text_field( $this->selector ),
			'hook'              => sanitize_text_field( $this->hook ),
		];

		$success = false;

		// Check if we have an id, and if so, check if this id exists in the database.
		if ( $this->id > 0 ) {
			// If legacy property exists, update it so we can clear the contents after saving.
			if ( $this->has_setup_column() ) {
				$args['setup'] = $this->setup;
			}
			$result  = $wpdb->update( $table_name, $args, [ 'ID' => $this->id ] );
			$success = $result !== false;
		} elseif ( $this->can_add_goal() ) {
			$this->date_created   = time();
			$args['date_created'] = $this->date_created;
			$result               = $wpdb->insert( $table_name, $args );
			if ( $result ) {
				$this->id = (int) $wpdb->insert_id;
				$success  = true;
			}
		}

		if ( $success ) {
			// Clear cache for this goal.
			wp_cache_delete( 'burst_goal_' . $this->id, 'burst' );
			// Prevent loops by ensuring the save (for upgrading) doesn't get called again in the get method.
			$this->get( false );
			do_action( 'burst_after_save_goals', $this );
		}

		return $success;
	}

	/**
	 * Check if the legacy column setup exists
	 */
	private function has_setup_column(): bool {
		global $wpdb;
		$table_name = $wpdb->prefix . 'burst_goals';
		return (bool) $wpdb->get_var( "SHOW COLUMNS FROM $table_name LIKE 'setup'" );
	}

	/**
	 * Delete a goal and its statistics
	 */
	public function delete(): bool {
		global $wpdb;
		$table_name = $wpdb->prefix . 'burst_goals';
		$result1    = $wpdb->delete( $table_name, [ 'ID' => $this->id ] );

		$table_name_statistics = $wpdb->prefix . 'burst_goal_statistics';
		$result2               = $wpdb->delete( $table_name_statistics, [ 'goal_id' => $this->id ] );

		// Check if both delete queries were successful.
		return $result1 !== false && $result2 !== false;
	}

	/**
	 * Add predefined goal
	 */
	public function add_predefined( string $id ): int {
		if ( ! $this->user_can_manage() ) {
			return 0;
		}

		$id    = sanitize_title( $id );
		$goals = ( new Goals() )->get_predefined_goals( true );
		// Filter out our goal by id.
		$filtered_goals = array_filter(
			$goals,
			static function ( $goal ) use ( $id ) {
				return $goal['id'] === $id;
			}
		);

		if ( count( $filtered_goals ) === 0 ) {
			return 0;
		}
		// Get first element of array.
		$goal = array_shift( $filtered_goals );
		unset( $goal['id'], $goal['description'] );
		// Add each item of this array to the current burst_goal object.
		// By default, we set conversion_metric to visitors.
		$this->conversion_metric = 'visitors';
		$this->status            = 'active';
		$this->url               = '*';
		foreach ( $goal as $name => $value ) {
			if ( property_exists( $this, $name ) ) {
				$this->{$name} = $value;
			}
		}

		$this->save();
		return $this->id;
	}

	/**
	 * Check if a new goal can be added
	 */
	private function can_add_goal(): bool {
		if ( $this->is_pro() ) {
			// @todo add licensing.
			// Allow unlimited goals in the pro version.
			return true;
		}

		global $wpdb;
		// Check for existing active goals in the database.
		$existing_goals = $wpdb->get_results( "SELECT * FROM {$wpdb->prefix}burst_goals", ARRAY_A );
		return count( $existing_goals ) <= 0;
	}

	/**
	 * Get the goal types. These are an option list from the goal_fields array.
	 *
	 * @return array<int, array{label: string, value: string}>
	 */
	private function get_available_goal_fields(): array {
		$fields = \Burst\burst_loader()->admin->app->fields->get_goal_fields();

		foreach ( $fields as $goal ) {
			if ( is_array( $goal ) && ( $goal['id'] ?? null ) === 'type' ) {
				return apply_filters( 'burst_goal_types', $goal['options'] ?? [] );
			}
		}

		return [];
	}
}
