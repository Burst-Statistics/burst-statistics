import { memo } from 'react';
import Flag from '@/components/Statistics/Flag';
import { createValueFormatter, formatNumber, formatPercentage, getCountryName } from '@/utils/formatting';
import { __, sprintf } from '@wordpress/i18n';
import { metricOptions } from '@/store/useGeoStore';

/**
 * ChoroplethTooltip component for displaying map feature details.
 * @param {object} props
 * @param {object} props.feature - The map feature object.
 * @param {number} [props.total] - The total value for percentage calculation.
 * @param {string} [props.selectedMetric] - The selected metric key.
 * @param {Function} [props.valueFormatter] - The value formatter function.
 * @param {string} [props.geoIpDatabaseType] - The geo IP database type ('city' or 'country').
 * @returns {JSX.Element|null}
 */
const ChoroplethTooltip = memo(
  ({ feature, total, selectedMetric, valueFormatter, geoIpDatabaseType }) => {
    if ( ! feature ) {
      return null;
    }
    const isSimpleTooltip = false;
    const isProvinceOrState =
      'Admin-0 country' !== feature.properties.featurecla;

    const locationName =
      feature.properties?.name ||
      feature.label ||
      __( 'Unknown location', 'burst-statistics' );
    const value = feature.value || 0;
    const metric = metricOptions[selectedMetric] || metricOptions.visitors;

    // Use provided valueFormatter or create a fallback
    const formattedValue = valueFormatter ?
      valueFormatter( value ) :
      createValueFormatter( selectedMetric, metricOptions )( value );

    // Show percentage of total based on metric configuration
    const showPercentageOfTotal = metric.showPercentageOfTotal;
    const percentage =
      total && 0 < total && showPercentageOfTotal ?
        formatPercentage( ( value / total ) * 100 ) :
        null;

    return (
      <div className="min-w-[10em] max-w-xs rounded-md border border-gray-200 bg-white p-3 text-sm shadow-lg">
        {/* Location Header */}
        {isProvinceOrState && feature.properties.name_en && (
          <span className="text-xs text-gray">
            {feature.properties.name_en} ({feature.properties.type_en})
          </span>
        )}
        <div className="mb-1 flex items-center gap-2 text-md font-semibold">
          {isProvinceOrState ? (
            <> {locationName} </>
          ) : (
            <Flag
              country={feature.properties.iso_a2}
              countryNiceName={getCountryName( feature.properties.iso_a2 )}
            />
          )}
        </div>

        {/* Continent and subregion. If continent and subregion are the same, only show continent */}
        {! isSimpleTooltip &&
          ! isProvinceOrState &&
          feature.properties.continent && (
            <div className="flex items-center gap-1">
              <div className="text-xs text-gray">
                {feature.properties.continent}
              </div>
              {feature.properties.continent !==
                feature.properties.subregion && (
                <>
                  <span className="text-xs text-gray">•</span>
                  <div className="text-xs text-gray">
                    {feature.properties.subregion}
                  </div>
                </>
              )}
            </div>
          )}

        {/* Primary Metric */}
        <div className="mb-2 mt-3 rounded-lg border border-gray-100 bg-gray-50 p-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium uppercase tracking-wide text-gray">
              {metric.label}
            </div>
            {metric.isPercentage && (
              <div className="bg-blue-500 h-2 w-2 rounded-full"></div>
            )}
          </div>
          <div className="mt-1 text-xl font-bold text-black">
            {formattedValue}
          </div>
          {showPercentageOfTotal && percentage && (
            <div className="mt-1 flex items-center gap-1 text-xs text-gray">
              <div className="h-1 w-1 rounded-full bg-gray-400"></div>
              {sprintf(

                /* translators: %s: Percentage value */
                __( '%s of total', 'burst-statistics' ),
                percentage
              )}
            </div>
          )}
        </div>

        {/* Population data */}
        {! isSimpleTooltip && feature.properties.pop_est && (
          <>
            <div className="text-xs text-gray">
              {sprintf(

                /* translators: 1: Population number, 2: Year */
                __( 'Population: %1$s (%2$s)', 'burst-statistics' ),
                formatNumber( feature.properties.pop_est ),
                feature.properties.pop_year
              )}
            </div>
          </>
        )}

        {/* gdp data. gdp_md and gdp_year. If gdp is not available, don't show it. add gdp_year to show the year of the gdp data. Nicely format the number. */}
        {/* {!isSimpleTooltip && feature.properties.gdp_md && (
                <>
                    <div className="text-xs text-gray">
                        GDP: {formatNumber(feature.properties.gdp_md)} ({feature.properties.gdp_year})
                    </div>
                </>
            )} */}

        {/* Click to see country specific data - Only for city database type */}
        {! isProvinceOrState && 'city' === geoIpDatabaseType && (
          <div className="mt-2 text-xs font-semibold text-gray">
            {__( 'Click to see country specific data', 'burst-statistics' )}
          </div>
        )}
      </div>
    );
  }
);

export default ChoroplethTooltip;
