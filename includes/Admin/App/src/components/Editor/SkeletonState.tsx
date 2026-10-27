import React from 'react';

/**
 * Skeleton loader matching the shape of the loaded per-page statistics panel.
 *
 * @return Skeleton placeholder layout with pulsing animation.
 */
export const SkeletonState: React.FC = () => (
	<div className="flex flex-col gap-3 py-3 animate-pulse" aria-hidden="true">
		{ /* Headline placeholder */ }
		<div className="flex flex-col gap-1.5 mb-1">
			<div className="h-4 w-4/5 rounded bg-gray-200" />
			<div className="h-3 w-3/5 rounded bg-gray-100" />
		</div>

		{ /* KPI grid placeholder */ }
		<div className="grid grid-cols-2 gap-2">
			{ [ 0, 1, 2, 3 ].map( ( key ) => (
				<div key={ key } className="h-16 rounded-md bg-gray-100 p-2.5 flex flex-col justify-between">
					<div className="h-2.5 w-12 rounded bg-gray-200" />
					<div className="h-4 w-16 rounded bg-gray-200" />
				</div>
			) ) }
		</div>

		{ /* Trendline placeholder */ }
		<div className="h-20 w-full rounded-md bg-gray-100 mt-1" />

		{ /* Sub-section placeholder rows */ }
		<div className="flex flex-col gap-2 mt-2">
			<div className="h-8 w-full rounded bg-gray-50 border border-gray-100" />
			<div className="h-8 w-full rounded bg-gray-50 border border-gray-100" />
			<div className="h-8 w-full rounded bg-gray-50 border border-gray-100" />
		</div>
	</div>
);
