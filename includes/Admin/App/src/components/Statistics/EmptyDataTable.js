import { __ } from '@wordpress/i18n';
import { memo } from 'react';

/**
 * Row height constant for consistent sizing.
 * Based on react-data-table-component default row height.
 */
const ROW_HEIGHT = 48;
const HEADER_HEIGHT = 52;
const PAGINATION_HEIGHT = 56;
const ROWS_COUNT = 10;
const MIN_HEIGHT = HEADER_HEIGHT + ROW_HEIGHT * ROWS_COUNT + PAGINATION_HEIGHT;

/**
 * SkeletonRow component for rendering a single skeleton row.
 *
 * @param {Object}  props       - The properties passed to the component.
 * @param {number}  props.index - Row index for staggered animation delay.
 * @param {boolean} props.isLast - Whether this is the last row.
 *
 * @return {JSX.Element} A skeleton row element.
 */
const SkeletonRow = ({ index, isLast }) => {

	// Stagger animation delay for wave effect.
	const delay = `${index * 100}ms`;

	// Vary the widths for more realistic look.
	const widths = [ '70%', '85%', '60%', '90%', '75%', '80%', '65%', '88%', '72%', '78%' ];
	const width = widths[index % widths.length];

	return (
		<div
			className={`flex items-center gap-4 px-6 max-xl:px-2.5 ${! isLast ? 'border-b border-gray-100' : ''}`}
			style={{ height: `${ROW_HEIGHT}px` }}
		>
			{/* First column - wider, simulates URL/name. */}
			<div
				className="h-4 bg-gray-200 rounded animate-pulseSlow flex-1 max-w-[280px]"
				style={{
					animationDelay: delay,
					width
				}}
			/>
			{/* Second column - narrower, simulates metric. */}
			<div
				className="h-4 bg-gray-200 rounded animate-pulseSlow w-16 ml-auto"
				style={{ animationDelay: `${( index * 100 ) + 50}ms` }}
			/>
		</div>
	);
};

/**
 * SkeletonHeader component for rendering the skeleton table header with blurred text.
 *
 * @return {JSX.Element} A skeleton header element.
 */
const SkeletonHeader = () => {
	return (
		<div
			className="flex items-center gap-4 px-6 max-xl:px-2.5 border-b border-gray-200 bg-gray-50"
			style={{ height: `${HEADER_HEIGHT}px` }}
		>
			{/* First column header - blurred text effect. */}
			<div className="flex items-center gap-2 flex-1">
				<span
					className="text-sm font-semibold text-gray-400 select-none animate-pulseSlow"
					style={{ filter: 'blur(4px)' }}
				>
					{__( 'Page URL', 'burst-statistics' )}
				</span>
			</div>
			{/* Second column header - blurred text effect. */}
			<div className="flex items-center gap-2 ml-auto">
				<span
					className="text-sm font-semibold text-gray-400 select-none animate-pulseSlow"
					style={{ filter: 'blur(4px)' }}
				>
					{__( 'Pageviews', 'burst-statistics' )}
				</span>
			</div>
		</div>
	);
};

/**
 * SkeletonPagination component for rendering a disabled pagination bar.
 *
 * @return {JSX.Element} A skeleton pagination element.
 */
const SkeletonPagination = () => {
	return (
		<div
			className="flex items-center justify-end gap-4 px-6 max-xl:px-2.5 border-t border-gray-200 bg-white"
			style={{ height: `${PAGINATION_HEIGHT}px` }}
		>
			{/* Rows per page selector skeleton. */}
			<div className="flex items-center gap-2">
				<div
					className="h-8 w-16 bg-gray-100 rounded border border-gray-200 animate-pulseSlow"
					style={{ animationDelay: '200ms' }}
				/>
			</div>

			{/* Page info skeleton. */}
			<span
				className="text-sm text-gray-400 select-none animate-pulseSlow"
				style={{ filter: 'blur(3px)', animationDelay: '100ms' }}
			>
				1-10 {__( 'of', 'burst-statistics' )} 100
			</span>

			{/* Navigation buttons skeleton. */}
			<div className="flex items-center gap-1">
				{/* First page button. */}
				<div
					className="w-8 h-8 bg-gray-100 rounded border border-gray-200 animate-pulseSlow flex items-center justify-center"
					style={{ animationDelay: '150ms' }}
				>
					<svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
					</svg>
				</div>
				{/* Previous page button. */}
				<div
					className="w-8 h-8 bg-gray-100 rounded border border-gray-200 animate-pulseSlow flex items-center justify-center"
					style={{ animationDelay: '200ms' }}
				>
					<svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
					</svg>
				</div>
				{/* Next page button. */}
				<div
					className="w-8 h-8 bg-gray-100 rounded border border-gray-200 animate-pulseSlow flex items-center justify-center"
					style={{ animationDelay: '250ms' }}
				>
					<svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
					</svg>
				</div>
				{/* Last page button. */}
				<div
					className="w-8 h-8 bg-gray-100 rounded border border-gray-200 animate-pulseSlow flex items-center justify-center"
					style={{ animationDelay: '300ms' }}
				>
					<svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
					</svg>
				</div>
			</div>
		</div>
	);
};

/**
 * LoadingState component for displaying a skeleton table.
 *
 * @return {JSX.Element} A skeleton table element.
 */
const LoadingState = () => {
	return (
		<div
			className="w-full"
			style={{ minHeight: `${MIN_HEIGHT}px` }}
		>
			<SkeletonHeader />
			<div>
				{[ ...Array( ROWS_COUNT ) ].map( ( _, index ) => (
					<SkeletonRow
						key={index}
						index={index}
						isLast={index === ROWS_COUNT - 1}
					/>
				) )}
			</div>
			<SkeletonPagination />
		</div>
	);
};

/**
 * EmptyPagination component for rendering a disabled pagination bar for empty/error states.
 *
 * @return {JSX.Element} A disabled pagination element.
 */
const EmptyPagination = () => {
	return (
		<div
			className="flex items-center justify-end gap-4 px-6 max-xl:px-2.5 border-t border-gray-200 bg-white opacity-40"
			style={{ height: `${PAGINATION_HEIGHT}px` }}
		>
			{/* Rows per page selector. */}
			<div className="flex items-center gap-2">
				<div className="h-8 w-16 bg-gray-100 rounded border border-gray-200" />
			</div>

			{/* Page info. */}
			<span className="text-sm text-gray-400 select-none">
				0-0 {__( 'of', 'burst-statistics' )} 0
			</span>

			{/* Navigation buttons. */}
			<div className="flex items-center gap-1">
				<div className="w-8 h-8 bg-gray-100 rounded border border-gray-200 flex items-center justify-center">
					<svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
					</svg>
				</div>
				<div className="w-8 h-8 bg-gray-100 rounded border border-gray-200 flex items-center justify-center">
					<svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
					</svg>
				</div>
				<div className="w-8 h-8 bg-gray-100 rounded border border-gray-200 flex items-center justify-center">
					<svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
					</svg>
				</div>
				<div className="w-8 h-8 bg-gray-100 rounded border border-gray-200 flex items-center justify-center">
					<svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
					</svg>
				</div>
			</div>
		</div>
	);
};

/**
 * EmptyState component for displaying when no data is available.
 *
 * @return {JSX.Element} An empty state element.
 */
const EmptyState = () => {
	return (
		<div
			className="w-full flex flex-col"
			style={{ minHeight: `${MIN_HEIGHT}px` }}
		>
			{/* Content area. */}
			<div
				className="flex-1 flex flex-col items-center justify-center text-center"
			>
				{/* Empty state icon. */}
				<div className="mb-4">
					<svg
						className="w-16 h-16 text-gray-300"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						strokeWidth={1}
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
						/>
					</svg>
				</div>
				{/* Empty state message. */}
				<h3 className="text-base font-medium text-gray-600 mb-1">
					{__( 'No data to display', 'burst-statistics' )}
				</h3>
				<p className="text-sm text-gray-400 max-w-xs">
					{__( 'There is no data available for the selected filters and date range.', 'burst-statistics' )}
				</p>
			</div>
			{/* Disabled pagination. */}
			<EmptyPagination />
		</div>
	);
};

/**
 * ErrorState component for displaying error messages.
 *
 * @param {Object} props         - The properties passed to the component.
 * @param {Object} props.error   - The error object.
 *
 * @return {JSX.Element} An error state element.
 */
const ErrorState = ({ error }) => {
	return (
		<div
			className="w-full flex flex-col"
			style={{ minHeight: `${MIN_HEIGHT}px` }}
		>
			{/* Content area. */}
			<div
				className="flex-1 flex flex-col items-center justify-center text-center"
			>
				{/* Error icon. */}
				<div className="mb-4">
					<svg
						className="w-16 h-16 text-red-light"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						strokeWidth={1}
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
						/>
					</svg>
				</div>
				{/* Error message. */}
				<h3 className="text-base font-medium text-gray-600 mb-1">
					{__( 'Something went wrong', 'burst-statistics' )}
				</h3>
				<p className="text-sm text-gray-400 max-w-xs">
					{error?.message || __( 'An unexpected error occurred while loading data.', 'burst-statistics' )}
				</p>
			</div>
			{/* Disabled pagination. */}
			<EmptyPagination />
		</div>
	);
};

/**
 * EmptyDataTable is a functional component that handles different states of data loading.
 * It displays different messages based on whether the data is loading, there's an error, no data is available, or an unexpected error occurred.
 *
 * @param {Object}  props           - The properties passed to the component.
 * @param {boolean} props.isLoading - Indicates whether the data is currently loading.
 * @param {Object}  props.error     - An error object that may occur during data loading.
 * @param {boolean} props.noData    - Indicates whether there is no data available.
 *
 * @return {JSX.Element} A div element containing a message based on the current state.
 */
const EmptyDataTable = ({ isLoading, error, noData }) => {

	// Loading state.
	if ( isLoading ) {
		return <LoadingState />;
	}

	// Error state.
	if ( error ) {
		return <ErrorState error={error} />;
	}

	// No data state.
	if ( noData ) {
		return <EmptyState />;
	}

	// Fallback or unexpected error state.
	return <ErrorState error={null} />;
};

// Export memoized component to prevent unnecessary re-renders.
export default memo( EmptyDataTable );
