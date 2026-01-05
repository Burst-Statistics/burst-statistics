import React, { useMemo } from 'react';
import { ResponsiveFunnel } from '@nivo/funnel';
import { FunnelStepLabels } from './FunnelStepLabels';
import { FunnelStepStatistics } from './FunnelStepStatistics';
import { FunnelTooltip } from './FunnelTooltip';
import {
	FunnelChartProps,
	StepStatistics
} from './types';
import { __, sprintf } from '@wordpress/i18n';

/**
 * FunnelChart component to render a funnel chart using Nivo.
 *
 * @param {FunnelChartProps} props - The properties for the FunnelChart component.
 *
 * @return {JSX.Element} The rendered funnel chart.
 */
export const FunnelChart: React.FC<FunnelChartProps> = ({
	data
}) => {

	// Use index-based IDs for consistent animation between data states.
	// Nivo tracks elements by ID to animate transitions. Using position-based
	// IDs ensures smooth animations when switching between placeholder and real data.
	const formattedData = useMemo( () => {

		// Filter out invalid entries and ensure we have valid data
		const validData = data.filter( item =>
			item &&
			! isNaN( item.value ) &&
			0 <= item.value &&
			item.stage
		);

		// If no valid data, return a minimal placeholder
		if ( 0 === validData.length ) {
			return [ {
				id: 'step-0',
				value: 1,
				label: __( 'No data', 'burst-statistics' )
			} ];
		}

		return validData.map( ( item, index ) => ({
			id: `step-${index}`,
			value: Math.max( 0, item.value ), // Ensure non-negative
			label: item.stage
		}) );
	}, [ data ]);

	// Check if all values are 0 to change the funnel visually.
	const hasData = useMemo( () => {
		return data.some( ( item ) => 0 < item.value );
	}, [ data ]);

	// Calculate statistics for each step.
	const statistics = useMemo( () => {
		const totalValue = data[0]?.value || 1;
		const stats: StepStatistics[] = data.map( ( item, index ) => {
			const currentValue = item.value;
			const nextValue = data[index + 1]?.value ?? 0;
			const percentage = ( currentValue / totalValue ) * 100;
			const dropOff =
				index < data.length - 1 ? currentValue - nextValue : null;
			const dropOffPercentage =
				index < data.length - 1 ?
					0 === currentValue ?
						0 :
						( ( dropOff ?? 0 ) / currentValue ) * 100 :
					null;


			return {
				label: item.stage,
				value: currentValue,
				percentage,
				dropOff,
				dropOffPercentage,
				isHighestDropOff: false
			};
		});

		// Find the highest drop-off percentage.
		const validDropOffs = stats
			.map( ( s ) => s.dropOffPercentage ?? -Infinity )
			.filter( ( v ) => ! isNaN( v ) && 0 < v );

		const highestDropOffValue =
			0 < validDropOffs.length ? Math.max( ...validDropOffs ) : null;

		// Mark the step with the highest drop-off.
		let highestMarked = false;
		stats.forEach( ( stat, index ) => {
			if (
				! highestMarked &&
				null !== highestDropOffValue &&
				stats[index] &&
				stats[index].dropOffPercentage === highestDropOffValue
			) {
				stat.isHighestDropOff = true;
				highestMarked = true;
			}
		});

		return stats;
	}, [ data ]);

	// catch fatal errors when no valid data is provided.
	if ( ! data || 0 === data.length || ! formattedData || 0 === formattedData.length ) {
		return (
			<div className="border-t border-t-divider p-4">
				{__( 'No funnel data available', 'burst-statistics' )}
			</div>
		);
	}

	return (
		<div className="border-t border-t-divider">
			<div
				className="grid"
				style={{
					gridTemplateRows: 'auto 1fr auto',
					minHeight: '300px'
				}}
			>
				{/* Step labels - top layer */}
				<div style={{ gridRow: '1', gridColumn: '1' }}>
					<FunnelStepLabels steps={statistics} />
				</div>

				{/* Funnel chart - middle layer, spans all rows, inverted */}
				<div
					style={{
						gridRow: '1 / -1',
						gridColumn: '1',
						zIndex: 0,
						height: '100%',
						pointerEvents: hasData ? 'auto' : 'none'
					}}
				>
					<ResponsiveFunnel
						data={formattedData}
						spacing={4}
						margin={{
							left: 0,
							right: 0,
							bottom: 0,
							top: 0
						}}
						shapeBlending={0.35}
						direction="horizontal"
						enableLabel={false}
						enableBeforeSeparators={true}
						enableAfterSeparators={true}
						beforeSeparatorLength={hasData ? 50 : 150}
						afterSeparatorLength={hasData ? 70 : 170}
						borderWidth={0}
						currentPartSizeExtension={5}
						animate={true}
						borderColor="#2E8A37"
						interpolation="smooth"
						colors="#2E8A37"
						motionConfig="gently"
						tooltip={({ part }) => {

							// Extract index from the position-based ID (e.g., 'step-0' -> 0).
							const currentIndex = parseInt(
								part.data.id.replace( 'step-', '' ),
								10
							);
							const totalValue = data[0]?.value || 1;
							const currentValue = part.data.value;
							const previousValue =
								0 < currentIndex ?
									data[currentIndex - 1].value :
									0;
							const nextValue =
								currentIndex < data.length - 1 ?
									data[currentIndex + 1].value :
									0;

							// Calculate conversion from previous step.
							const conversionInRate =
								0 < previousValue ?
									( currentValue / previousValue ) * 100 :
									100;

							// Calculate drop-off to next step.
							const dropoffOutRate =
								currentIndex < data.length - 1 &&
								0 < currentValue ?
									( ( currentValue - nextValue ) /
											currentValue ) *
										100 :
									0;

							// Calculate lost sessions.
							const lostSessions =
								currentIndex < data.length - 1 ?
									currentValue - nextValue :
									0;

							// Calculate potential gain to final step (sales).
							const improvementPercentage = 10;
							const lastStepValue =
								data[data.length - 1]?.value || 0;

							// Calculate conversion rate from next step to last step.
							const conversionToLastStep =
								currentIndex < data.length - 1 && 0 < nextValue ?
									lastStepValue / nextValue :
									0;

							// Calculate potential gain: saved sessions * conversion rate to final step.
							const savedSessions = Math.round(
								( lostSessions * improvementPercentage ) / 100
							);
							const potentialGain = Math.round(
								savedSessions * conversionToLastStep
							);

							const potentialGainText =
								currentIndex < data.length - 1 ?
									sprintf(
											__(
												'Improving this by %s%% could lead to ~%d more sales.',
												'burst-statistics'
											),
											improvementPercentage,
											potentialGain
										) :
									'';
							const tooltipData = {
								stepTitle: part.data.label,
								sessionCount: currentValue,
								sessionPercentage:
									( currentValue / totalValue ) * 100,
								conversionInRate,
								dropoffOutRate,
								lostSessions,
								potentialGainText
							};

							return <FunnelTooltip data={tooltipData} />;
						}}
					/>
				</div>

				{/* Step statistics - top layer above funnel */}
				<div
					style={{
						gridRow: '3',
						gridColumn: '1',
						zIndex: 1,
						pointerEvents: 'none'
					}}
				>
					<FunnelStepStatistics steps={statistics} />
				</div>
			</div>
		</div>
	);
};
