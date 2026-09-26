import { memo } from 'react';
import { __ } from '@wordpress/i18n';
import clsx from 'clsx';
import { formatNumber } from '@/utils/formatting';

export type FilterTab = 'all' | 'internal' | 'external';

type ReferrerFilterTabsProps = {
	activeTab: FilterTab;
	counts: {
		all: number;
		internal: number;
		external: number;
	};
	onTabChange: ( tab: FilterTab ) => void;
};

const TABS: { id: FilterTab; label: string; countKey: keyof ReferrerFilterTabsProps['counts'] }[] = [
	{ id: 'all', label: __( 'All', 'burst-statistics' ), countKey: 'all' },
	{ id: 'internal', label: __( 'Internal', 'burst-statistics' ), countKey: 'internal' },
	{ id: 'external', label: __( 'External', 'burst-statistics' ), countKey: 'external' }
];

export const ReferrerFilterTabs = memo(
	({ activeTab, counts, onTabChange }: ReferrerFilterTabsProps ) => {
		return (
			<div className="mt-3.5 flex rounded-lg bg-gray-100 p-1 text-xs">
				{TABS.map( ({ id, label, countKey }) => {
					const isActive = id === activeTab;
					return (
						<button
							key={id}
							type="button"
							onClick={() => onTabChange( id )}
							className={clsx(
								'flex-1 rounded-md py-1 px-2 text-center transition-all cursor-pointer',
								isActive ?
									'bg-white text-text-black shadow-xs font-semibold' :
									'text-text-gray hover:text-text-black font-medium'
							)}
						>
							{label}{' '}
							<span
								className={clsx(
									'ml-0.5 font-normal',
									isActive ? 'text-text-black' : 'text-text-gray-light'
								)}
							>
								{formatNumber( counts[countKey])}
							</span>
						</button>
					);
				})}
			</div>
		);
	}
);

ReferrerFilterTabs.displayName = 'ReferrerFilterTabs';
