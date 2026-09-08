import { __ } from '@wordpress/i18n';

/**
 * Skeleton shown during the local Search Console request.
 */
export const SearchQueriesLoadingState = () => (
	<div
		className="min-h-52 animate-pulse space-y-4"
		aria-label={ __( 'Loading search queries', 'burst-statistics' ) }
	>
		<div className="h-4 w-72 rounded bg-gray-100" />
		{Array.from({ length: 5 }).map( ( _, index ) => (
			<div key={index} className="h-8 rounded bg-gray-100" />
		) )}
	</div>
);
