import React, { useCallback, useMemo, useState } from 'react';
import { useParams, useSearch } from '@tanstack/react-router';
import { __ } from '@wordpress/i18n';
import * as Select from '@radix-ui/react-select';
import Icon from '@/utils/Icon';
import DataTableBlock from '@/components/Statistics/DataTableBlock';
import ErrorBoundary from '@/components/Common/ErrorBoundary';
import { SheetOverlay } from '@/components/Common/SheetOverlay';

/**
 * Label and icon mapping for each datatable variant key.
 * Mirrors the config labels defined in DataTableBlock.
 */
const VARIANT_META: Record<string, { label: string; icon: string }> = {
	pages: { label: __( 'Pages', 'burst-statistics' ), icon: 'page' },
	referrers: { label: __( 'Referrers', 'burst-statistics' ), icon: 'referrer' },
	countries: { label: __( 'Locations', 'burst-statistics' ), icon: 'world' },
	campaigns: { label: __( 'Campaigns', 'burst-statistics' ), icon: 'campaign' },
	parameters: { label: __( 'Parameters', 'burst-statistics' ), icon: 'parameters' },
	products: { label: __( 'Products', 'burst-statistics' ), icon: 'shopping-cart' },
	subscription_products: { label: __( 'Plan performance', 'burst-statistics' ), icon: 'calendar-sync' },
	search_terms: { label: __( 'Website searches', 'burst-statistics' ), icon: 'search' },
	not_found_pages: { label: __( '404 Pages', 'burst-statistics' ), icon: 'page' },
	outgoing_links: { label: __( 'Outgoing links', 'burst-statistics' ), icon: 'external-link' },
	forms: { label: __( 'Forms', 'burst-statistics' ), icon: 'chat' },
	reading_engagement: { label: __( 'Reading engagement', 'burst-statistics' ), icon: 'page' }
};

/**
 * DataTableOverlay — full-screen bottom sheet for exploring datatable data.
 *
 * Opened via the /table/$variant route. Shows a variant switcher, filters,
 * date range, and a full-height scrollable DataTableBlock. On close, the
 * user is returned to the source page with the current filter/date context
 * applied.
 *
 * @return {JSX.Element} The overlay component.
 */
// fallow-ignore-next-line complexity
export const DataTableOverlay: React.FC = () => {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const params = useParams({ strict: false }) as Record<string, any>;
	const variant = ( params.variant as string ) || 'pages';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const search = useSearch({ strict: false }) as Record<string, any>;

	const allowed     = ( search.allowed as string ) || ( variant || 'pages' );
	const dataTableId = ( search.dataTableId as string ) || 'datatable';

	const allowedConfigs = useMemo(
		() => allowed.split( ',' ).filter( Boolean ),
		[ allowed ]
	);

	// Track the currently selected variant locally for instant switching.
	const [ selectedVariant, setSelectedVariant ] = useState( variant );

	/**
	 * Handle variant change from the dropdown.
	 *
	 * @param {string} newVariant - The newly selected variant key.
	 */
	const handleVariantChange = useCallback( ( newVariant: string ) => {
		setSelectedVariant( newVariant );
	}, []);

	// Build dropdown options from the allowed configs.
	const variantOptions = useMemo( () => {
		return allowedConfigs
			.filter( ( key ) => VARIANT_META[ key ])
			.map( ( key ) => ({
				key,
				...VARIANT_META[ key ]
			}) );
	}, [ allowedConfigs ]);

	const currentLabel = VARIANT_META[ selectedVariant ]?.label || selectedVariant;
	const showDropdown = 1 < variantOptions.length;

	const title = showDropdown ? (
		<Select.Root value={ selectedVariant } onValueChange={ handleVariantChange }>
			<Select.Trigger
				className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium shadow-sm transition-all cursor-pointer hover:border-gray-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
				aria-label={ __( 'Select Variant', 'burst-statistics' ) }
			>
				<Icon
					name={ VARIANT_META[ selectedVariant ]?.icon || 'page' }
					size={ 16 }
					color="gray"
				/>
				<Select.Value>{ currentLabel }</Select.Value>
				<Select.Icon>
					<Icon name="chevron-down" size={ 14 } color="gray" />
				</Select.Icon>
			</Select.Trigger>

			{/* No Select.Portal: content must stay inside the `.burst` scoped
			  * wrapper so scoped styles and the z-index scale apply. */}
			<Select.Content
				className="burst z-dropdown min-w-[200px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl animate-in fade-in-0 zoom-in-95"
				position="popper"
				sideOffset={ 6 }
				align="start"
			>
				<div className="bg-white text-text-black rounded-xl">
					<Select.Viewport className="p-1.5">
						{ variantOptions.map( ( option ) => (
							<Select.Item
								key={ option.key }
								value={ option.key }
								className="relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm cursor-pointer select-none transition-colors data-highlighted:bg-green-50 data-highlighted:outline-none data-[state=checked]:text-green-700 data-[state=checked]:font-medium"
							>
								<Select.ItemText className="flex items-center gap-2">
									<span className="flex items-center gap-2">
										<Icon name={ option.icon } size={ 16 } color="gray" />
										{ option.label }
									</span>
								</Select.ItemText>
							</Select.Item>
						) ) }
					</Select.Viewport>
				</div>
			</Select.Content>
		</Select.Root>
	) : (
		<div className="flex items-center gap-2 px-1">
			<Icon
				name={ VARIANT_META[ selectedVariant ]?.icon || 'page' }
				size={ 16 }
				color="gray"
			/>
			<h2 className="text-lg font-semibold m-0">
				{ currentLabel }
			</h2>
		</div>
	);

	return (
		<SheetOverlay title={ title } overlayId="datatable-overlay">
			<ErrorBoundary>
				<DataTableBlock
					allowedConfigs={ [ selectedVariant ] }
					id={ dataTableId }
					isInOverlay={ true }
				/>
			</ErrorBoundary>
		</SheetOverlay>
	);
};
