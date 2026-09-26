import { memo, useMemo, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { __, sprintf } from '@wordpress/i18n';
import clsx from 'clsx';
import Icon from '@/utils/Icon';
import { formatNumber } from '@/utils/formatting';
import { useNotFoundPageReferrers } from './useNotFoundPageReferrers';
import { ReferrerFilterTabs } from './ReferrerFilterTabs';
import { ReferrersList } from './ReferrersList';
import { ReferrerPopoverFooter } from './ReferrerPopoverFooter';
import getPortalContainer from '@/utils/getPortalContainer';
import type { FilterTab } from './ReferrerFilterTabs';

type NotFoundPageReferrersPopoverProps = {
	pageUrl: string;
};

const TOP_N = 5;

const NotFoundPageReferrersPopover = memo(
	({ pageUrl }: NotFoundPageReferrersPopoverProps ) => {
		const [ isOpen, setIsOpen ] = useState( false );
		const [ activeTab, setActiveTab ] = useState<FilterTab>( 'all' );
		const [ showAll, setShowAll ] = useState( false );

		const { data, isLoading, error } = useNotFoundPageReferrers({
			pageUrl,
			enabled: isOpen
		});

		const portalContainer = getPortalContainer();

		const filteredReferrers = useMemo( () => {
			const list = Array.isArray( data.referrers ) ? data.referrers : [];
			if ( 'internal' === activeTab ) {
				return list.filter( ( r ) => r.is_internal );
			}
			if ( 'external' === activeTab ) {
				return list.filter( ( r ) => ! r.is_internal );
			}
			return list;
		}, [ data.referrers, activeTab ]);

		const visibleReferrers = useMemo( () => {
			if ( showAll ) {
				return filteredReferrers;
			}
			return filteredReferrers.slice( 0, TOP_N );
		}, [ filteredReferrers, showAll ]);

		const maxHits = useMemo( () => {
			if ( 0 === filteredReferrers.length ) {
				return 1;
			}
			return Math.max( ...filteredReferrers.map( ( r ) => r.hits ), 1 );
		}, [ filteredReferrers ]);

		const handleTabChange = ( tab: FilterTab ) => {
			setActiveTab( tab );
			setShowAll( false );
		};

		const isLoaded = ! isLoading && ! error;

		return (
			<Popover.Root open={isOpen} onOpenChange={setIsOpen}>
				<Popover.Trigger asChild>
					<button
						type="button"
						className={clsx(
							'inline-flex items-center justify-center p-1 rounded-sm border border-gray-200 bg-gray-50 text-text-gray hover:bg-gray-200 hover:text-text-black transition-colors cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-blue-500',
							isOpen && 'bg-gray-200 text-text-black'
						)}
						aria-label={__( 'Show 404 referrers', 'burst-statistics' )}
						title={__( 'Show referrers', 'burst-statistics' )}
					>
						<Icon name="link" size={13} color="currentColor" />
					</button>
				</Popover.Trigger>

				<Popover.Portal container={portalContainer}>
					<Popover.Content
						align="end"
						sideOffset={8}
						className="burst z-modal w-[360px] rounded-xl border border-gray-200 bg-white p-4 shadow-xl text-text-black"
					>
						{/* Header */}
						<div className="flex items-start justify-between gap-2">
							<div className="min-w-0 flex-1">
								<div className="text-[10px] font-bold uppercase tracking-wider text-text-gray">
									{__( 'REFERRERS', 'burst-statistics' )}
								</div>
								<h4
									className="mt-0.5 text-sm font-bold text-text-black truncate"
									title={pageUrl}
								>
									{pageUrl}
								</h4>
								<p className="mt-0.5 text-xs text-text-gray">
									{sprintf(

										/* translators: %s: formatted hits count */
										__( '%s hits in selected period', 'burst-statistics' ),
										formatNumber( data.total_hits )
									)}
								</p>
							</div>
							<Popover.Close asChild>
								<button
									type="button"
									className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-text-gray hover:bg-gray-200 hover:text-text-black transition-colors cursor-pointer shrink-0"
									aria-label={__( 'Close', 'burst-statistics' )}
								>
									<Icon name="close" size={12} color="currentColor" />
								</button>
							</Popover.Close>
						</div>

						{error ? (
							<div className="py-8 text-center text-xs text-red-500">
								{__( 'Failed to load referrers.', 'burst-statistics' )}
							</div>
						) : (
							<>
								<ReferrerFilterTabs
									activeTab={activeTab}
									counts={data.counts}
									onTabChange={handleTabChange}
								/>

								<div className="mt-3.5 flex items-center justify-between px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-text-gray border-b border-gray-100">
									<span>{__( 'REFERRING URL', 'burst-statistics' )}</span>
									<span>{__( 'HITS', 'burst-statistics' )}</span>
								</div>

								<ReferrersList
									referrers={visibleReferrers}
									maxHits={maxHits}
									isLoading={isLoading}
									showAll={showAll}
								/>

								{isLoaded && (
									<ReferrerPopoverFooter
										noReferrerHits={data.no_referrer_hits}
										totalReferrers={filteredReferrers.length}
										topN={TOP_N}
										showAll={showAll}
										onToggleShowAll={() => setShowAll( ! showAll )}
									/>
								)}
							</>
						)}
					</Popover.Content>
				</Popover.Portal>
			</Popover.Root>
		);
	}
);

NotFoundPageReferrersPopover.displayName = 'NotFoundPageReferrersPopover';

export default NotFoundPageReferrersPopover;
