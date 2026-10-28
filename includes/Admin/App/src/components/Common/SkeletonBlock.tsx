type SkeletonBlockProps = {
	className: string;
};

/**
 * A placeholder block with pulsing lines, shown while a page loads.
 *
 * @param {Object} props           - Component props.
 * @param {string} props.className - Grid placement classes for the block.
 * @return {JSX.Element} The SkeletonBlock component.
 */
export const SkeletonBlock = ({ className }: SkeletonBlockProps ) => (
	<div className={ `${ className } bg-white shadow-sm rounded-xl p-5 dark:bg-dashboard-dark-surface @max-sm:col-span-12 @max-sm:row-span-1` }>
		<div className="h-6 w-1/2 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
		<div className="h-6 w-4/5 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
		<div className="h-6 w-full px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
		<div className="h-6 w-5/6 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
		<div className="h-6 w-4/5 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
		<div className="h-6 w-5/6 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
		<div className="h-6 w-full px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
		<div className="h-6 w-5/6 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
	</div>
);
