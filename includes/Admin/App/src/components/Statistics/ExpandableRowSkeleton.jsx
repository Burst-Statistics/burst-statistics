/**
 * Animated loading skeleton shown inside expandable sub-rows while data is fetching.
 *
 * Renders three staggered placeholder bars. Used by ParameterVariationsRow and
 * SourceReferrersRow so the skeleton UI isn't duplicated across both components.
 *
 * @return {JSX.Element} Three animated placeholder rows.
 */
const ExpandableRowSkeleton = () => (
	<div className="space-y-1.5 py-1" aria-busy="true">
		{[ 0, 1, 2 ].map( ( i ) => (
			<div
				key={`burst-row-skeleton-${i}`}
				className="flex items-center gap-3 pl-6"
			>
				<div
					className="h-3 flex-1 max-w-[280px] animate-pulseSlow rounded bg-gray-200"
					style={{ animationDelay: `${i * 100}ms` }}
				/>
				<div
					className="h-3 w-16 animate-pulseSlow rounded bg-gray-200"
					style={{ animationDelay: `${i * 100}ms` }}
				/>
			</div>
		) )}
	</div>
);

export default ExpandableRowSkeleton;
