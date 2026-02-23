<?php
namespace Burst\Admin\Reports;

use Burst\Admin\Reports\DomainTypes\Report_Day_Of_Week;
use Burst\Admin\Reports\DomainTypes\Report_Frequency;
use Burst\Traits\Helper;

class Date_Range {
	use Helper;

	public int $start;
	public int $end;
	public string $start_nice;
	public string $end_nice;
	public int $compare_start;
	public int $compare_end;


	/**
	 * Constructor for the Date_Range class.
	 *
	 * @param string $frequency the frequency of the report (e.g., 'weekly', 'monthly').
	 */
	public function __construct( string $frequency ) {
		if ( $frequency === Report_Frequency::MONTHLY ) {
			$first_day = gmdate( 'Y-m-01' );
			$start     = gmdate( 'Y-m-01', strtotime( '-1 month', strtotime( $first_day ) ) );
			$end       = gmdate( 'Y-m-t', strtotime( $start ) );

			$compare_start = gmdate( 'Y-m-01', strtotime( '-2 months', strtotime( $first_day ) ) );
			$compare_end   = gmdate( 'Y-m-t', strtotime( $compare_start ) );
		} else {
			$week_start      = (int) get_option( 'start_of_week' );
			$weekdays        = Report_Day_Of_Week::all();
			$today           = strtotime( 'today' );
			$this_week_start = strtotime( 'last ' . $weekdays[ $week_start ], $today + DAY_IN_SECONDS );

			$start = gmdate( 'Y-m-d', $this_week_start - WEEK_IN_SECONDS );
			$end   = gmdate( 'Y-m-d', $this_week_start - 1 );

			$compare_start = gmdate( 'Y-m-d', $this_week_start - 2 * WEEK_IN_SECONDS );
			$compare_end   = gmdate( 'Y-m-d', $this_week_start - WEEK_IN_SECONDS - 1 );
		}

		$start_unix = self::convert_date_to_unix( $start . ' 00:00:00' );
		$end_unix   = self::convert_date_to_unix( $end . ' 23:59:59' );

		$this->start         = $start_unix;
		$this->end           = $end_unix;
		$this->start_nice    = date_i18n( get_option( 'date_format' ), $start_unix );
		$this->end_nice      = date_i18n( get_option( 'date_format' ), $end_unix );
		$this->compare_start = self::convert_date_to_unix( $compare_start . ' 00:00:00' );
		$this->compare_end   = self::convert_date_to_unix( $compare_end . ' 23:59:59' );
	}
}
