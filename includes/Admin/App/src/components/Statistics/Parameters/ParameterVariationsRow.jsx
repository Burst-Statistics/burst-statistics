import { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getPageParameterKeys } from '@/api/getPageParameters';
import { safeDecodeURI } from '@/utils/lib';
import useExpandableRowQuery from '@/hooks/useExpandableRowQuery';
import { useFilters } from '@/hooks/useFilters';
import ExpandableRowSkeleton from '../ExpandableRowSkeleton';
import ParameterLevelOnePane from './ParameterLevelOnePane';
import ParameterLevelTwoPane from './ParameterLevelTwoPane';

const DEDICATED_UTM_FILTER_KEYS = new Set([
	'utm_source',
	'utm_medium',
	'utm_campaign',
	'utm_term',
	'utm_content'
]);

/**
 * Row used inside react-data-table-component's `expandableRowsComponent`.
 *
 * Implements a two-level drill-down for page parameters:
 * - Level 1: Parameter keys summary with tagged/untagged split.
 * - Level 2: Lazy-loaded parameter values with server-side roll-up, search,
 *   sorting, kebab actions, and high-cardinality guard.
 *
 * @param {Object} props           Component props.
 * @param {Object} props.data      The parent row data from the pages datatable.
 * @param {string} props.startDate Active start date for the current view.
 * @param {string} props.endDate   Active end date for the current view.
 * @param {string} props.range     Active date range identifier.
 *
 * @return {JSX.Element} Two-level drill-down table of parameter variations.
 */
// fallow-ignore-next-line complexity
const ParameterVariationsRow = ({ data, startDate, endDate, range }) => {
	const pageUrl = data?.page_url || '';

	const containerRef = useRef( null );
	const [ level, setLevel ] = useState( 1 );
	const [ activeKey, setActiveKey ] = useState( null );
	const [ userReturnedToLevelOne, setUserReturnedToLevelOne ] = useState( false );
	const [ frozenHeight, setFrozenHeight ] = useState( null );

	const { setFilters } = useFilters();

	const { isLoading, error, rows, meta } = useExpandableRowQuery({
		queryKey: [ 'page-parameter-keys', pageUrl, startDate, endDate ],
		queryFn: () =>
			getPageParameterKeys({
				pageUrl,
				startDate,
				endDate,
				range
			}),
		enabled: Boolean( pageUrl && startDate && endDate )
	});

	const totalPageviews = Number( meta?.total_pageviews ?? data?.pageviews ?? 0 );

	// Single key auto-skip: if exactly 1 parameter key is returned and user hasn't explicitly
	// gone back to Level 1, auto-skip straight to Level 2.
	const isSingleKey = ! isLoading && ! error && 1 === rows.length;
	const isSingleKeyAutoSkip = isSingleKey && ! userReturnedToLevelOne;

	useEffect( () => {
		if ( isSingleKeyAutoSkip && rows[0]?.parameter && 1 === level ) {
			setActiveKey( rows[0].parameter );
			setLevel( 2 );
		}
	}, [ isSingleKeyAutoSkip, rows, level ]);

	const activeKeyRow = useMemo( () => {
		return rows.find( ( r ) => r.parameter === activeKey );
	}, [ rows, activeKey ]);

	const handleSelectKey = useCallback( ( key ) => {
		setActiveKey( key );
		setLevel( 2 );
	}, []);

	const handleBack = useCallback( () => {
		setUserReturnedToLevelOne( true );
		setActiveKey( null );
		setLevel( 1 );
	}, []);

	const handleFilter = useCallback(
		( key, value ) => {
			if ( DEDICATED_UTM_FILTER_KEYS.has( key ) ) {
				setFilters( key, value );
			} else {
				setFilters( 'parameter', `${key}=${value}` );
			}
		},
		[ setFilters ]
	);

	const handleExclude = useCallback(
		( key, value ) => {
			if ( DEDICATED_UTM_FILTER_KEYS.has( key ) ) {
				setFilters( key, `!${value}` );
			} else {
				setFilters( 'parameter', `!${key}=${value}` );
			}
		},
		[ setFilters ]
	);

	const handleSearchOpenChange = useCallback( ( isOpen ) => {
		if ( isOpen && containerRef.current ) {
			setFrozenHeight( containerRef.current.offsetHeight );
		} else {
			setFrozenHeight( null );
		}
	}, []);

	const taggedPageviews = Number( meta?.tagged_pageviews ?? 0 );
	const untaggedPageviews = Number( meta?.untagged_pageviews ?? ( totalPageviews - taggedPageviews ) );
	const untaggedVisitors = Number( meta?.untagged_visitors ?? 0 );

	const prefersReducedMotion =
		'undefined' !== typeof window &&
		window.matchMedia &&
		window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;

	return (
		<div
			ref={containerRef}
			style={frozenHeight ? { minHeight: `${frozenHeight}px` } : undefined}
			className="border-b border-gray-100 bg-gray-50 px-6 py-4 transition-all duration-180 ease-in-out @max-xl:px-2.5"
		>
			{isLoading && <ExpandableRowSkeleton />}

			{ ! isLoading && error && (
				<div className="rounded-md border border-red-200 bg-red-50 p-4 text-xs text-red-600">
					{__( 'Could not load parameter variations.', 'burst-statistics' )}
				</div>
			)}

			{ ! isLoading && ! error && 0 === rows.length && (
				<div className="rounded-md border border-gray-200 bg-white p-6 shadow-2xs space-y-1">
					<div className="text-sm font-semibold text-text-black">
						{sprintf(

							// translators: %s is the page URL.
							__( 'Every view of %s arrived on a clean URL', 'burst-statistics' ),
							safeDecodeURI( pageUrl )
						)}
					</div>
					<p className="text-xs text-text-gray">
						{__(
							'No campaign or query parameters were recorded in this period.',
							'burst-statistics'
						)}
					</p>
				</div>
			)}

			{ ! isLoading && ! error && 0 < rows.length && (
				<div
					className={
						prefersReducedMotion ?
							'' :
							'transition-opacity duration-180 ease-in-out'
					}
				>
					{1 === level && (
						<ParameterLevelOnePane
							rows={rows}
							pageUrl={pageUrl}
							totalPageviews={totalPageviews}
							taggedPageviews={taggedPageviews}
							untaggedPageviews={untaggedPageviews}
							untaggedVisitors={untaggedVisitors}
							onSelectKey={handleSelectKey}
						/>
					)}

					{2 === level && activeKey && (
						<ParameterLevelTwoPane
							activeKey={activeKey}
							keyViews={Number( activeKeyRow?.pageviews ?? totalPageviews )}
							totalValues={Number( activeKeyRow?.value_count ?? 0 )}
							isHighCardinality={Boolean( activeKeyRow?.high_cardinality )}
							isSingleKeyAutoSkip={isSingleKeyAutoSkip}
							pageUrl={pageUrl}
							startDate={startDate}
							endDate={endDate}
							range={range}
							onBack={handleBack}
							onFilter={handleFilter}
							onExclude={handleExclude}
							onSearchOpenChange={handleSearchOpenChange}
						/>
					)}
				</div>
			)}
		</div>
	);
};

export default memo( ParameterVariationsRow );
