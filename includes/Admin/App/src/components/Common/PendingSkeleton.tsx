import { SkeletonBlock } from '@/components/Common/SkeletonBlock';

/**
 * The three skeleton blocks of a loading page. Renders grid items only, so it
 * must be placed inside the root layout's 12-column grid.
 *
 * @return {JSX.Element} The PendingSkeleton component.
 */
export const PendingSkeleton = () => (
	<>
		{/* Left Block */}
		<SkeletonBlock className="col-span-6 row-span-2" />

		{/* Middle Block */}
		<SkeletonBlock className="col-span-3 row-span-2" />

		{/* Right Block */}
		<SkeletonBlock className="col-span-3 row-span-2" />
	</>
);
