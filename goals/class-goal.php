<?php

if ( ! class_exists( 'burst_goal' ) ) {
	class burst_goal {
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
		public $setup;
		public $attribute       = 'class';
		public $attribute_value = '';
		public $hook            = '';
		public $page_or_website = 'website';
		public $specific_page   = '';

		public function __construct( $id = 0 ) {
			$this->id = (int) $id;
			$this->get();
		}

		public function __get( $property ) {
			if ( property_exists( $this, $property ) ) {
				return $this->$property;
			}
		}

		public function __set( $property, $value ) {
			if ( property_exists( $this, $property ) ) {
				$this->$property = $value;
			}

			return $this;
		}

		private function get( $upgrade = true ) {
			if ( $this->id === 0 ) {
				return false;
			}

			global $wpdb;
			$goal = wp_cache_get( 'burst_goal_' . $this->id, 'burst' );
			if ( ! $goal ) {
				$goal = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}burst_goals WHERE ID = %s", $this->id ) );
				wp_cache_set( 'burst_goal_' . $this->id, $goal, 'burst', 10 );
			}

			if ( ! $goal ) {
				return false;
			}

			$this->title             = $goal->title !== '' ? $goal->title : __( 'New goal', 'burst-statistics' );
			$this->type              = $goal->type;
			$this->status            = $goal->status;
			$this->server_side       = $goal->server_side;
			$this->url               = $goal->url;
			$this->conversion_metric = $goal->conversion_metric;
			$this->attribute         = empty( $goal->attribute ) ? 'class' : $goal->attribute;
			$this->attribute_value   = empty( $goal->attribute_value ) ? '' : $goal->attribute_value;
			$this->hook              = empty( $goal->hook ) ? '' : $goal->hook;
			$this->date_start        = $goal->date_start;
			$this->date_end          = 0;//$goal->date_end > 0 ? $goal->date_end : strtotime( 'tomorrow midnight' ) - 1;
			$this->date_created      = $goal->date_created;

			// split url property into two separate properties, depending on * value
			$this->page_or_website = $this->url !== '*' ? 'page' : 'website';
			$this->specific_page   = $this->page_or_website === 'page' ? $this->url : '';

			// upgrade old structure data, then remove it
			$setup = isset( $goal->setup ) ? json_decode( $goal->setup, false ) : null;
			if ( $upgrade && $setup !== null && isset( $setup->attribute ) && isset( $setup->value ) ) {
				$this->attribute       = $setup->attribute;
				$this->attribute_value = $setup->value;
				$this->setup           = null;
				$this->save();
			}

			return $this;
		}

		/**
		 * @return void
		 */
		public function save(): void {
			do_action( 'burst_before_save_goals' );
			global $wpdb;
			$table_name           = $wpdb->prefix . 'burst_goals';
			$available_goal_types = $this->get_available_goal_types();
			// merge url property from two separate properties, depending on 'website' value
			$url               = $this->page_or_website === 'website' ? '*' : $this->specific_page;
			$this->url         = $url !== '*' ? burst_sanitize_relative_url( $url ) : '*';
			$this->server_side = $available_goal_types[ $this->sanitize_type( $this->type ) ]['server_side'] ?? 0;
			//update start time only if the goal status has changed to active, or if it's a new goal
            $db_goal = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}burst_goals WHERE ID = %s", $this->id ) );
            if ( $db_goal) {
                if (  $db_goal->status !== $this->status && $this->status === 'active' ) {
                    $this->date_start = time();
                    $this->date_end = 0;
                }
            } else {
                $this->date_start = time();
                $this->date_end = 0;
            }

			$args              = [
				'title'             => sanitize_text_field( $this->title ),
				'type'              => $this->sanitize_type( $this->type ),
				'status'            => $this->sanitize_status( $this->status ),
				'server_side'       => $this->server_side,
				'url'               => $this->url,
				'conversion_metric' => $this->sanitize_metric( $this->conversion_metric ),
				'date_start'        => $this->date_start,
				'date_end'          => $this->date_end,
				'date_created'      => (int) $this->date_created,
				'attribute'         => sanitize_text_field( $this->attribute ),
				'attribute_value'   => sanitize_text_field( $this->attribute_value ),
				'hook'              => sanitize_text_field( $this->hook ),
			];

			// check if we have an id, and if so, check if this id exists in the database
			if ( $this->id > 0 ) {
				// if legacy property exists, update it so we can clear the contents after saving
				if ( $this->has_setup_column() ) {
					$args['setup'] = $this->setup;
				}
				$wpdb->update( $table_name, $args, [ 'ID' => $this->id ] );
			} elseif ( $this->can_add_goal() ) {
				$args['date_created'] = $this->date_created = time();
				$wpdb->insert( $table_name, $args );
				$this->id = (int) $wpdb->insert_id;
			}

			// prevent loops by ensuring the save (for upgrading) doesn't get called again in the get method .
			$this->get( false );
		}

		/**
		 * Check if the legacy column setup exists
		 *
		 * @return bool
		 */
		private function has_setup_column(): bool {
			global $wpdb;
			$table_name = $wpdb->prefix . 'burst_goals';
			return (bool) $wpdb->get_var( "SHOW COLUMNS FROM $table_name LIKE 'setup'" );
		}

		/**
		 * Delete a goal and its statistics
		 *
		 * @return bool
		 */
		public function delete(): bool {
			global $wpdb;
			$table_name = $wpdb->prefix . 'burst_goals';
			$result1    = $wpdb->delete( $table_name, [ 'ID' => $this->id ] );

			$table_name_statistics = $wpdb->prefix . 'burst_goal_statistics';
			$result2               = $wpdb->delete( $table_name_statistics, [ 'goal_id' => $this->id ] );

			// Check if both delete queries were successful
			return $result1 !== false && $result2 !== false;
		}

		/**
		 * Add predefined goal
		 *
		 * @param string $id
		 *
		 * @return burst_goal|bool
		 */
		public function add_predefined( string $id ): burst_goal {
			if ( ! burst_user_can_manage() ) {
				return false;
			}

			$id    = sanitize_title( $id );
			$goals = BURST()->goals->get_predefined_goals(true);
			// filter out our goal by id
			$filtered_goals = array_filter(
				$goals,
				static function ( $goal ) use ( $id ) {
					return $goal['id'] === $id;
				}
			);

			if ( count( $filtered_goals ) === 0 ) {
				return false;
			}
			// get first element of array
			$goal = array_shift( $filtered_goals );
			unset( $goal['id'], $goal['description'] );
			// add each item of this array to the current burst_goal object
			foreach ( $goal as $name => $value ) {
				if ( property_exists( $this, $name ) ) {
					$this->{$name} = $value;
				}
			}
			$this->save();
			return $this;
		}

		/**
		 * Sanitize a goal type
		 *
		 * @param mixed $type
		 *
		 * @return string
		 */
		private function sanitize_type( $type ): string {
			$available_goal_types = $this->get_available_goal_types();
			return isset( $available_goal_types[ $type ] ) ? $type : 'clicks';
		}

		/**
		 * Check if a new goal can be added
		 *
		 * @return bool
		 */
		private function can_add_goal(): bool {
			if ( burst_is_pro() ) {
				// @todo add licensing
				return true; // Allow unlimited goals in the pro version
			}

			global $wpdb;
			// Check for existing active goals in the database
			$existing_goals = $wpdb->get_results( "SELECT * FROM {$wpdb->prefix}burst_goals", ARRAY_A );
			return count( $existing_goals ) <= 0;
		}

		/**
		 * Sanitize a metric
		 *
		 * @param mixed $metric
		 *
		 * @return string
		 */
		private function sanitize_metric( $metric ): string {
			$available_metrics = [ 'pageviews', 'visitors', 'sessions' ];
			return in_array( $metric, $available_metrics, true ) ? $metric : 'visitors';
		}

		/**
		 * Sanitize status
		 *
		 * @param mixed $status
		 *
		 * @return string
		 */
		public function sanitize_status( $status ): string {
			$statuses = array(
				'all',
				'active',
				'inactive',
				'archived',
			);
			return in_array( $status, $statuses, true ) ? $status : 'inactive';
		}

		/**
		 * Get the goal types. These are an option list from the goal_fields array
		 *
		 * @return array
		 */
		private function get_available_goal_types(): array {
			$fields = burst_goal_fields();
			// from the fields array, get the entry where id = 'type'
			$type_field = array_filter(
				$fields,
				static function ( $goal ) {
					return isset( $goal['id'] ) && $goal['id'] === 'type';
				}
			);

			$type_field = reset( $type_field );
			return apply_filters( 'burst_goal_types', $type_field['options'] );
		}
	}
}
