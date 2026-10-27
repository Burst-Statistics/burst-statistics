import React from 'react';
import { __, sprintf } from '@wordpress/i18n';
import type { RevisionMarker } from '@/api/getPageRevisionsData';
import type { MetricItem } from '@/utils/comparisonDates';
import { availableRanges } from '@/utils/formatting';

export interface HeadlineProps {
	isPro: boolean;
	latestRevision?: RevisionMarker | null;
	pageviewsMetric?: MetricItem;
	rangeKey?: string;
}

// fallow-ignore-next-line complexity
const getProRevisionHeadline = ( revision: RevisionMarker ): string => {
	const change = revision.changePercent;
	const absChange = Math.round( Math.abs( change ) );

	if ( 0 < change ) {
		return sprintf(

			/* translators: %d: percentage change */
			__( 'Pageviews up %d%% since you updated this post', 'burst-statistics' ),
			absChange
		);
	}
	if ( 0 > change ) {
		return sprintf(

			/* translators: %d: percentage change */
			__( 'Pageviews down %d%% since you updated this post', 'burst-statistics' ),
			absChange
		);
	}
	return __( 'Pageviews unchanged since you updated this post', 'burst-statistics' );
};

// fallow-ignore-next-line complexity
const getFreeCompareHeadline = ( metric?: MetricItem, rangeKey: string = 'last-30-days' ): string => {
	const rangeDef = ( availableRanges as Record<string, { label?: string }> )[ rangeKey ];
	const periodLabel = rangeDef?.label || __( 'Last 30 days', 'burst-statistics' );
	const fallbackHeadline = sprintf(

		/* translators: %s: date range label, e.g. "Last 30 days". */
		__( 'Page performance: %s', 'burst-statistics' ),
		periodLabel
	);

	if ( ! metric ) {
		return fallbackHeadline;
	}

	const rawChange = metric.change ?? '';
	const cleanChange = rawChange.replace( /^[↑↓▲▼\s]+/, '' ).trim();
	const status = metric.changeStatus;
	const changeText = cleanChange || rawChange;

	if ( 'positive' === status ) {
		return sprintf(

			/* translators: %s: percentage or value change */
			__( 'Pageviews up %s vs previous period', 'burst-statistics' ),
			changeText
		);
	}
	if ( 'negative' === status ) {
		return sprintf(

			/* translators: %s: percentage or value change */
			__( 'Pageviews down %s vs previous period', 'burst-statistics' ),
			changeText
		);
	}
	if ( '-' !== changeText && '' !== changeText ) {
		return sprintf(

			/* translators: %s: percentage or value change */
			__( 'Pageviews %s vs previous period', 'burst-statistics' ),
			changeText
		);
	}
	return fallbackHeadline;
};

/**
 * Derives and renders the conclusion headline for the per-page editor statistics panel.
 *
 * In Pro: derived from the latest revision's engagement score changePercent.
 * In Free: derived from the pageviews compare change vs the previous period.
 *
 * @param props                 - Component properties.
 * @param props.isPro           - Whether Burst Pro is active.
 * @param props.latestRevision  - The most recent revision marker if available.
 * @param props.pageviewsMetric - The pageviews comparison metric.
 * @param props.rangeKey        - Currently selected period range key.
 * @return Headline heading element.
 */
// fallow-ignore-next-line complexity
export const Headline: React.FC<HeadlineProps> = ({
	isPro,
	latestRevision,
	pageviewsMetric,
	rangeKey = 'last-30-days'
}) => {
	const text = isPro && latestRevision ?
		getProRevisionHeadline( latestRevision ) :
		getFreeCompareHeadline( pageviewsMetric, rangeKey );

	return (
		<h2 className="mb-3 text-sm font-semibold leading-snug text-text-black">
			{ text }
		</h2>
	);
};
