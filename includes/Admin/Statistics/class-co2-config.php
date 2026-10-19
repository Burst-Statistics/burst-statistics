<?php
/**
 * Sustainable Web Design Model v4 constants used by CO2 reporting.
 *
 * @package Burst\Admin\Statistics
 */
namespace Burst\Admin\Statistics;

defined( 'ABSPATH' ) || die();

/**
 * Central configuration for the Sustainable Web Design Model v4 calculation.
 */
class Co2_Config {

	public const BYTES_PER_GB = 1000000000;

	public const GRID_INTENSITY = 494;

	public const RENEWABLES_INTENSITY = 50;

	public const OPERATIONAL_DATA_CENTER_KWH_PER_GB = 0.055;
	public const OPERATIONAL_NETWORK_KWH_PER_GB     = 0.059;
	public const OPERATIONAL_DEVICE_KWH_PER_GB      = 0.080;

	public const EMBODIED_DATA_CENTER_KWH_PER_GB = 0.012;
	public const EMBODIED_NETWORK_KWH_PER_GB     = 0.013;
	public const EMBODIED_DEVICE_KWH_PER_GB      = 0.081;

	/**
	 * Digital Carbon Rating bands for SWDM v4, in grams CO2e per pageview.
	 *
	 * Each entry is the inclusive upper bound of that grade; anything above the
	 * last bound is an F. Values mirror SWDMV4_RATINGS in co2.js, see
	 * https://github.com/thegreenwebfoundation/co2.js/blob/main/src/constants/index.js
	 * and the outputRating() helper that consumes them.
	 */
	private const CARBON_RATING_BANDS = [
		'A+' => 0.040,
		'A'  => 0.079,
		'B'  => 0.145,
		'C'  => 0.209,
		'D'  => 0.278,
		'E'  => 0.359,
	];

	/**
	 * Return the Digital Carbon Rating for an emissions figure per pageview.
	 *
	 * @param float $grams_per_pageview Estimated grams CO2e for a single pageview.
	 */
	public static function get_carbon_rating( float $grams_per_pageview ): string {
		foreach ( self::CARBON_RATING_BANDS as $rating => $upper_bound ) {
			if ( $grams_per_pageview <= $upper_bound ) {
				return $rating;
			}
		}

		return 'F';
	}

	/**
	 * Return the emissions of one transferred GB on verified green hosting.
	 *
	 * The block offers a preview of what the estimate would look like on green
	 * hosting. Emissions scale linearly with this figure, so handing it to the
	 * frontend alongside the real one lets the preview be a pure display toggle
	 * — no request, no stored state, nothing that alters what anyone else sees.
	 */
	public static function get_green_grams_per_gb(): float {
		return self::grams_per_gb( self::RENEWABLES_INTENSITY );
	}

	/**
	 * Return the emissions of one transferred GB on grid-powered hosting.
	 */
	private static function get_non_green_grams_per_gb(): float {
		return self::grams_per_gb( self::GRID_INTENSITY );
	}

	/**
	 * Return the emissions of one transferred GB for a data-centre intensity.
	 *
	 * SWDM v4 assigns green hosting 50 gCO2e/kWh for operational data-centre
	 * energy only; embodied data-centre energy remains on the grid intensity.
	 * See https://github.com/thegreenwebfoundation/co2.js/blob/main/src/constants/index.js
	 * and https://github.com/thegreenwebfoundation/co2.js/blob/main/src/sustainable-web-design-v4.js.
	 *
	 * @param float $data_center_intensity gCO2e/kWh for operational data-centre energy.
	 */
	private static function grams_per_gb( float $data_center_intensity ): float {
		return ( self::OPERATIONAL_DATA_CENTER_KWH_PER_GB * $data_center_intensity )
			+ ( self::grid_energy_kwh_per_gb() * self::GRID_INTENSITY );
	}

	/**
	 * Energy per GB that stays on grid intensity under SWDM v4.
	 */
	private static function grid_energy_kwh_per_gb(): float {
		return self::OPERATIONAL_NETWORK_KWH_PER_GB
			+ self::OPERATIONAL_DEVICE_KWH_PER_GB
			+ self::EMBODIED_DATA_CENTER_KWH_PER_GB
			+ self::EMBODIED_NETWORK_KWH_PER_GB
			+ self::EMBODIED_DEVICE_KWH_PER_GB;
	}

	/**
	 * Return the configured emissions produced by transferring one GB.
	 */
	public static function get_grams_per_gb(): float {
		return Green_Hosting::uses_green_hosting() ? self::get_green_grams_per_gb() : self::get_non_green_grams_per_gb();
	}
}
