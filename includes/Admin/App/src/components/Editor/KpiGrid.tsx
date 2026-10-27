import React from 'react';
import { __ } from '@wordpress/i18n';
import type { CompareData, MetricItem } from '@/utils/comparisonDates';

export interface KpiGridProps {
	compareData: CompareData;
	isPro: boolean;
}

interface KpiCardProps {
	title: string;
	metric?: MetricItem;
	fallbackValue?: string;
}

/**
 * Single KPI card displaying a metric value and change indicator.
 *
 * @param props               - Component properties.
 * @param props.title         - Card title.
 * @param props.metric        - MetricItem from comparison dataset.
 * @param props.fallbackValue - Fallback string if metric value is not set.
 * @return Card container element.
 */
// fallow-ignore-next-line complexity
const KpiCard: React.FC<KpiCardProps> = ({ title, metric, fallbackValue = '-' }) => {
	const value = metric?.value ?? fallbackValue;
	const rawChange = metric?.change ?? '';
	const status = metric?.changeStatus ?? '';

	// Strip existing arrow glyphs so we control the symbol cleanly without doubles.
	const cleanPercent = rawChange.replace( /^[↑↓▲▼\s]+/, '' ).trim();
	const isZero = ! cleanPercent || '0%' === cleanPercent || '0.0%' === cleanPercent;
	const hasChange = Boolean( rawChange && '-' !== rawChange && '' !== rawChange );
	const isPositive = 'positive' === status && ! isZero;
	const isNegative = 'negative' === status && ! isZero;

	const displayChange = isZero ?
		'0%' :
		`${ isPositive ? '↑' : isNegative ? '↓' : '' } ${ cleanPercent }`.trim();

	return (
		<div className="flex flex-col justify-between rounded-md border border-gray-200 bg-white p-2.5 shadow-xs">
			<span className="text-[11px] font-medium text-text-gray">
				{ title }
			</span>
			<div className="mt-1 flex items-baseline justify-between gap-1">
				<span className="text-base font-bold text-text-black">
					{ String( value ) }
				</span>
				{ hasChange && (
					<span
						className={ `flex items-center text-[10px] font-medium ${
							isZero ? 'text-text-gray' : isPositive ? 'text-green-600' : isNegative ? 'text-red-500' : 'text-text-gray'
						}` }
					>
						{ displayChange }
					</span>
				) }
			</div>
		</div>
	);
};

/**
 * KPI Grid for per-page statistics.
 *
 * Renders a 2x2 grid in Pro (Pageviews, Visitors, Engagement Score / Avg. Time, Bounce Rate),
 * or a 2-card row in Free (Pageviews, Visitors).
 *
 * @param props             - Component properties.
 * @param props.compareData - Comparison dataset.
 * @param props.isPro       - Whether Burst Pro is active.
 * @return Grid container element.
 */
// fallow-ignore-next-line complexity
export const KpiGrid: React.FC<KpiGridProps> = ({ compareData, isPro }) => {
	const pageviews = compareData?.pageviews;
	const visitors = compareData?.visitors;
	const bounceRate = compareData?.bounce_rate;

	// Use reading engagement score if available, otherwise fallback to avg. time on page.
	const engagement =
		compareData?.reading_engagement_score?.value && '-' !== compareData.reading_engagement_score.value ?
			compareData.reading_engagement_score :
			compareData?.avg_time_on_page;

	const engagementTitle =
		compareData?.reading_engagement_score?.value && '-' !== compareData.reading_engagement_score.value ?
			__( 'Engagement score', 'burst-statistics' ) :
			__( 'Avg. time on page', 'burst-statistics' );

	return (
		<div className="grid grid-cols-2 gap-2 mb-3">
			<KpiCard
				title={ __( 'Pageviews', 'burst-statistics' ) }
				metric={ pageviews }
			/>
			<KpiCard
				title={ __( 'Visitors', 'burst-statistics' ) }
				metric={ visitors }
			/>
			{ isPro && (
				<>
					<KpiCard
						title={ engagementTitle }
						metric={ engagement }
					/>
					<KpiCard
						title={ __( 'Bounce rate', 'burst-statistics' ) }
						metric={ bounceRate }
					/>
				</>
			) }
		</div>
	);
};
