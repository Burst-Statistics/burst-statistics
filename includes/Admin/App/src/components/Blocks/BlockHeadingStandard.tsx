import { memo, ReactNode } from 'react';
import clsx from 'clsx';
import { LoadingSpinner } from '@/components/Common/LoadingSpinner';
import ProBadge from '@/components/Common/ProBadge';
import { __ } from '@wordpress/i18n';

type BlockHeadingStandardProps = {
	title: ReactNode;
	subtitle?: ReactNode;
	controls?: ReactNode;
	className?: string;
	isLoading?: boolean;
	pro?: boolean;
	proId?: string;
};

/**
 * Standard block heading for dashboard and regular views.
 *
 * @param {Object}           props           - Component props.
 * @param {React.ReactNode}  props.title     - The heading title.
 * @param {React.ReactNode}  props.subtitle  - The subtitle
 * @param {React.ReactNode}  props.controls  - Optional controls to render on the right side.
 * @param {string}           props.className - Additional CSS classes.
 * @param {boolean}          props.isLoading - Whether the block is currently loading.
 * @param {boolean}          props.pro       - Whether this block is a Pro feature.
 * @param {string}           props.proId     - Optional feature id for tier-specific Pro checks.
 * @return {JSX.Element} The block heading component.
 */
export const BlockHeadingStandard = memo( ({ title, subtitle = '', controls, className = '', isLoading = false, pro = false, proId }: BlockHeadingStandardProps ) => {
	return (
		<div
			className={clsx(
				className,
				'flex min-h-14 items-center justify-between px-2.5 md:px-6 md:min-h-16 gap-4'
			)}
		>
			<div>
				<div className="flex items-center gap-2.5 min-w-0">
					<h2 className="text-lg font-semibold">{title}</h2>
					{isLoading && <LoadingSpinner />}
					{pro && <ProBadge id={proId} label={__( 'Pro', 'burst-statistics' )} />}
				</div>
				{subtitle && <p className="text-sm text-text-gray">{subtitle}</p>}
			</div>

			{controls}
		</div>
	);
});

BlockHeadingStandard.displayName = 'BlockHeadingStandard';
