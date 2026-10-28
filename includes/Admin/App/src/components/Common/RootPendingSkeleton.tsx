import { PendingSkeleton } from '@/components/Common/PendingSkeleton';

/**
 * Skeleton for the whole app while the root route is pending, for example
 * while its beforeLoad fetches a chunk. The root layout (header and grid) is
 * not rendered then, so this supplies both, matching the PHP skeleton in
 * App::dashboard(). The header holds no logo, so a white-label share link
 * does not flash the Burst brand.
 *
 * @return {JSX.Element} The RootPendingSkeleton component.
 */
export const RootPendingSkeleton = () => (
	<>
		<div className="bg-white shadow-sm dark:bg-dashboard-dark-surface">
			<div className="mx-auto flex max-w-(--breakpoint-2xl) items-center gap-5 px-3 @lg:px-10 @max-lg:px-4 min-h-16">
				<div className="h-6 w-32 bg-gray-200 rounded-md animate-pulse"></div>
			</div>
		</div>
		<div className="mx-auto flex max-w-(--breakpoint-2xl)">
			<div className="grid-rows-auto p-3 grid min-h-full w-full grid-cols-12 gap-3 @lg:py-5 @lg:px-10 @lg:gap-5 relative">
				<PendingSkeleton />
			</div>
		</div>
	</>
);
