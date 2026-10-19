import React, { useState, useCallback, memo } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { __ } from '@wordpress/i18n';
import Icon from '@/utils/Icon';
import getPortalContainer from '@/utils/getPortalContainer';
import { useCompareStore, COMPARE_MODES } from '@/store/useCompareStore';
import { toast } from '@/utils/toast';

interface ParameterKebabMenuProps {

	/** Parameter key name (e.g. 'utm_campaign', 'ref'). */
	paramKey: string;

	/** Parameter value string (e.g. 'summer_sale', '3.6.3'). */
	paramValue: string;

	/** Parent page URL for constructing tagged links. */
	pageUrl?: string;

	/** Callback invoked when the user filters on this value. */
	onFilter?: ( key: string, value: string ) => void;

	/** Callback invoked when the user excludes this value. */
	onExclude?: ( key: string, value: string ) => void;

	/** Optional additional CSS classes for trigger button. */
	className?: string;
}

/**
 * Builds the fully qualified tagged URL with the specified query parameter.
 *
 * @param {string} pageUrl    Target page path or URL.
 * @param {string} paramKey   Parameter key.
 * @param {string} paramValue Parameter value.
 * @return {string} Full tagged URL.
 */
// fallow-ignore-next-line complexity
const getTaggedUrl = ( pageUrl: string, paramKey: string, paramValue: string ): string => {
	const siteUrl = ( window as unknown as { burst_settings?: { site_url?: string } })
		?.burst_settings?.site_url || window.location.origin;

	let base = pageUrl || '/';
	if ( ! base.startsWith( 'http' ) ) {
		base = `${siteUrl}${base.startsWith( '/' ) ? '' : '/'}${base}`;
	}

	const joinChar = base.includes( '?' ) ? '&' : '?';
	return `${base}${joinChar}${encodeURIComponent( paramKey )}=${encodeURIComponent( paramValue )}`;
};

/**
 * Kebab action menu for a single parameter value row.
 *
 * Provides actions to filter, exclude, trigger comparison mode, or open the
 * fully constructed tagged URL in a new browser tab.
 *
 * @param {ParameterKebabMenuProps} props Component props.
 * @return {JSX.Element} Radix Popover kebab menu.
 */
// fallow-ignore-next-line complexity
const ParameterKebabMenu: React.FC<ParameterKebabMenuProps> = ({
	paramKey,
	paramValue,
	pageUrl = '',
	onFilter,
	onExclude,
	className = ''
}) => {
	const [ isOpen, setIsOpen ] = useState<boolean>( false );

	const handleFilter = useCallback(
		( event: React.MouseEvent ) => {
			event.stopPropagation();
			setIsOpen( false );
			onFilter?.( paramKey, paramValue );
		},
		[ onFilter, paramKey, paramValue ]
	);

	const handleExclude = useCallback(
		( event: React.MouseEvent ) => {
			event.stopPropagation();
			setIsOpen( false );
			onExclude?.( paramKey, paramValue );
		},
		[ onExclude, paramKey, paramValue ]
	);

	const handleCompare = useCallback(
		( event: React.MouseEvent ) => {
			event.stopPropagation();
			setIsOpen( false );
			onFilter?.( paramKey, paramValue );
			useCompareStore.getState().setCompareMode( COMPARE_MODES.PREVIOUS_PERIOD );
			toast.info( __( 'Comparing with previous period', 'burst-statistics' ) );
		},
		[ onFilter, paramKey, paramValue ]
	);

	const handleOpenUrl = useCallback(
		( event: React.MouseEvent ) => {
			event.stopPropagation();
			setIsOpen( false );
			const taggedUrl = getTaggedUrl( pageUrl, paramKey, paramValue );
			window.open( taggedUrl, '_blank', 'noopener,noreferrer' );
		},
		[ pageUrl, paramKey, paramValue ]
	);

	const portalContainer = getPortalContainer();

	return (
		<Popover.Root open={isOpen} onOpenChange={setIsOpen}>
			<Popover.Trigger asChild>
				<button
					type="button"
					onClick={( event ) => event.stopPropagation()}
					className={`flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 bg-white text-text-gray shadow-xs transition-colors hover:bg-gray-100 hover:text-text-black cursor-pointer focus:outline-hidden ${className}`}
					aria-label={__( 'More actions', 'burst-statistics' )}
					title={__( 'Actions', 'burst-statistics' )}
				>
					<Icon name="ellipsis" size={13} color="gray" />
				</button>
			</Popover.Trigger>

			<Popover.Portal container={portalContainer}>
				<Popover.Content
					className="burst z-dropdown min-w-[210px] overflow-hidden rounded-md border border-gray-200 bg-white p-1 text-xs shadow-lg text-text-black"
					align="end"
					sideOffset={4}
					onClick={( event ) => event.stopPropagation()}
				>
					<div className="flex flex-col space-y-0.5">
						<button
							type="button"
							onClick={handleFilter}
							className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs font-normal text-text-black hover:bg-gray-100 cursor-pointer border-0 bg-transparent shadow-none focus:outline-hidden"
						>
							<Icon name="plus" size={13} color="gray" />
							<span>{__( 'Filter on this value', 'burst-statistics' )}</span>
						</button>

						<button
							type="button"
							onClick={handleExclude}
							className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs font-normal text-text-black hover:bg-gray-100 cursor-pointer border-0 bg-transparent shadow-none focus:outline-hidden"
						>
							<Icon name="minus" size={13} color="gray" />
							<span>{__( 'Exclude this value', 'burst-statistics' )}</span>
						</button>

						<button
							type="button"
							onClick={handleCompare}
							className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs font-normal text-text-black hover:bg-gray-100 cursor-pointer border-0 bg-transparent shadow-none focus:outline-hidden"
						>
							<Icon name="compare-arrows" size={13} color="gray" />
							<span>{__( 'Compare with previous period', 'burst-statistics' )}</span>
						</button>

						<button
							type="button"
							onClick={handleOpenUrl}
							className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs font-normal text-text-black hover:bg-gray-100 cursor-pointer border-0 bg-transparent shadow-none focus:outline-hidden"
						>
							<Icon name="external-link" size={13} color="gray" />
							<span>{__( 'Open the tagged URL', 'burst-statistics' )}</span>
						</button>
					</div>
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	);
};

export default memo( ParameterKebabMenu );
