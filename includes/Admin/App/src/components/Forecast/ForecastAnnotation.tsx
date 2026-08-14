import { __, sprintf } from '@wordpress/i18n';
import { formatPercentage } from '@/utils/formatting';
import type {
	ForecastMetadata,
	ForecastMode,
	ForecastSource
} from '@/types/api-endpoints';

interface ForecastAnnotationProps {
	source: ForecastSource;
	mode: ForecastMode;
	metadata: ForecastMetadata;
}

/**
 * Shared forecast growth, churn and limited-history context.
 */
// fallow-ignore-next-line complexity
export function ForecastAnnotation({
	source,
	mode,
	metadata
}: ForecastAnnotationProps ): JSX.Element {
	const growthRate = metadata.growth_rate;
	const growthLabel = `${ 0 <= growthRate ? '+' : '' }${ formatPercentage( growthRate ) }`;
	const churnRate = metadata.churn_rate ?? 0;

	return (
		<div className="px-6 pt-3 text-xs text-text-gray-light">
			<span>
				{
					sprintf(

						/* translators: %s: projected yearly growth percentage. */
						__( 'Based on %s projected yearly growth.', 'burst-statistics' ),
						growthLabel
					)
				}
			</span>
			{ 'subscriptions' === source &&
				'revenue' === mode &&
				0 < churnRate && (
				<span>
					{
						' ' + sprintf(

							/* translators: %s: revenue churn percentage. */
							__( 'Adjusted for %s revenue churn.', 'burst-statistics' ),
							formatPercentage( churnRate )
						)
					}
				</span>
			) }
			{ metadata.limited_data && (
				<span>
					{ ' ' + __( 'Based on limited history.', 'burst-statistics' ) }
				</span>
			) }
		</div>
	);
}
