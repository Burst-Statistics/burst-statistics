<?php
namespace Burst\Admin\Statistics;

use Burst\Frontend\Tracking\Tracking;
use Burst\Traits\Admin_Helper;
use Burst\Traits\Database_Helper;
use Burst\Traits\Helper;
use Burst\Traits\Sanitize;
defined( 'ABSPATH' ) || die();

class Query_Data {
	use Sanitize;
	use Admin_Helper;

	public int $date_start       = 0;
	public int $date_end         = 0;
	public array $select         = [ '*' ];
	public array $filters        = [];
	public string $group_by      = '';
	public string $order_by      = '';
	public int $limit            = 0;
	public array $joins          = [];
	public array $date_modifiers = [];
	public array $having         = [];
	public string $custom_select = '';
	public string $custom_where  = '';
	public string $subquery      = '';
	public array $union          = [];
	public bool $distinct        = false;
	public array $window         = [];

	/**
	 * Constructor to initialize the Query_Data object with sanitizing arguments.
	 */
	public function __construct( array $args = [] ) {
		foreach ( $args as $key => $value ) {
			if ( property_exists( $this, $key ) ) {
				if ( $key === 'filters' ) {
					$this->$key = $this->sanitize_filters( $value );
				} elseif ( is_array( $value ) ) {
					$this->$key = array_map( 'esc_sql', $value );
				} elseif ( is_string( $value ) ) {
					$this->$key = esc_sql( $value );
				} elseif ( is_bool( $value ) || is_int( $value ) || is_float( $value ) ) {
					$this->$key = $value;
				}
			} else {
				$this::error_log( "Invalid property '$key' in Query_Data class. Please check your arguments." );
			}
		}
	}
}
