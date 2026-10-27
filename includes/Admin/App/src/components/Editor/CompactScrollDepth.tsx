import React, { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import type { ScrollAnalyticsData } from '@/api/getScrollAnalyticsData';
import { ChevronDown, ChevronUp } from 'lucide-react';

export interface CompactScrollDepthProps {
	scrollData?: ScrollAnalyticsData;
	isLoading?: boolean;
}

interface DepthTier {
	label: string;
	percentage: number;
}

const STAGE_KEYS: Record<string, string> = {
	'stage-0-25': '25%',
	'stage-25-50': '50%',
	'stage-50-75': '75%',
	'stage-75-100': '100%',
	'0-25': '25%',
	'25': '25%',
	'25-50': '50%',
	'50': '50%',
	'50-75': '75%',
	'75': '75%',
	'75-100': '100%',
	'100': '100%'
};

// fallow-ignore-next-line complexity
const resolveDepthTiers = ( scrollData?: ScrollAnalyticsData ): DepthTier[] => {
	const stages = scrollData?.funnel?.stages;
	if ( Array.isArray( stages ) && 0 < stages.length ) {
		const map: Record<string, number> = {};
		stages.forEach( ( s, idx ) => {
			const target = STAGE_KEYS[ String( s.id || '' ) ] || [ '25%', '50%', '75%', '100%' ][ idx ];
			if ( target ) {
				map[ target ] = Number( s.percentage ) || 0;
			}
		});

		return [
			{ label: '25%', percentage: map[ '25%' ] ?? 0 },
			{ label: '50%', percentage: map[ '50%' ] ?? 0 },
			{ label: '75%', percentage: map[ '75%' ] ?? 0 },
			{ label: '100%', percentage: map[ '100%' ] ?? 0 }
		];
	}

	const data = scrollData?.scroll_depth?.data;
	if ( Array.isArray( data ) && 0 < data.length ) {
		return data.slice( 0, 4 ).map( ( d, idx ) => ({
			label: [ '25%', '50%', '75%', '100%' ][ idx ] ?? String( d.range ),
			percentage: Number( d.percentage ) || 0
		}) );
	}

	return [
		{ label: '25%', percentage: 0 },
		{ label: '50%', percentage: 0 },
		{ label: '75%', percentage: 0 },
		{ label: '100%', percentage: 0 }
	];
};

/**
 * Compact scroll depth section showing reading reach across 25%, 50%, 75%, and 100%.
 *
 * @param props            - Component properties.
 * @param props.scrollData - Scroll analytics dataset.
 * @param props.isLoading  - Whether request is in-flight.
 * @return Collapsible section element.
 */
// fallow-ignore-next-line complexity
export const CompactScrollDepth: React.FC<CompactScrollDepthProps> = ({
	scrollData,
	isLoading = false
}) => {
	const [ isOpen, setIsOpen ] = useState( false );
	const tiers = React.useMemo( () => resolveDepthTiers( scrollData ), [ scrollData ]);
	const insight = scrollData?.scroll_depth?.insight?.range;

	return (
		<div className="border-t border-gray-200 py-3">
			<button
				type="button"
				onClick={ () => setIsOpen( ( prev ) => ! prev ) }
				className="flex w-full items-center justify-between text-left text-xs font-semibold text-text-black hover:text-gray-700"
			>
				<span>{ __( 'How far people read', 'burst-statistics' ) }</span>
				{ isOpen ? (
					<ChevronUp size={ 16 } className="text-gray-400" />
				) : (
					<ChevronDown size={ 16 } className="text-gray-400" />
				) }
			</button>

			{ isOpen && (
				<div className="mt-3 flex flex-col gap-2">
					{ isLoading ? (
						<div className="flex flex-col gap-2 animate-pulse">
							{ [ 0, 1, 2, 3 ].map( ( key ) => (
								<div key={ key } className="h-3 w-full rounded bg-gray-100" />
							) ) }
						</div>
					) : (
						<>
							{ tiers.map( ( tier ) => (
								<div key={ tier.label } className="flex items-center gap-2 text-xs">
									<span className="w-8 shrink-0 text-text-gray font-medium">
										{ tier.label }
									</span>
									<div className="relative h-2 flex-1 rounded-full bg-gray-100 overflow-hidden">
										<div
											className="h-full rounded-full bg-green-600 transition-all duration-300"
											style={{ width: `${ Math.min( Math.max( tier.percentage, 0 ), 100 ) }%` }}
										/>
									</div>
									<span className="w-8 shrink-0 text-right font-semibold text-text-black">
										{ `${ tier.percentage }%` }
									</span>
								</div>
							) ) }

							{ insight && (
								<p className="mt-1 text-[11px] text-text-gray">
									{ sprintf(

										/* translators: %s: scroll depth range, e.g. 50–75% */
										__( 'Biggest drop-off: %s', 'burst-statistics' ),
										insight
									) }
								</p>
							) }
						</>
					) }
				</div>
			) }
		</div>
	);
};
