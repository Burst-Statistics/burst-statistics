import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { __ } from '@wordpress/i18n';
import * as Select from '@radix-ui/react-select';
import Icon from '@/utils/Icon';
import DataTableBlock from '@/components/Statistics/DataTableBlock';
import { PageFilter } from '@/components/Filters/PageFilter';
import DateRange from '@/components/Statistics/DateRange';
import ErrorBoundary from '@/components/Common/ErrorBoundary';
import { FILTER_KEYS } from '@/config/filterConfig';

// Duration in ms, matched to the exit spring animation.
const EXIT_DURATION_MS = 0;

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
 * applied (Option B propagation).
 *
 * @return {JSX.Element} The overlay component.
 */
export const DataTableOverlay: React.FC = () => {
	const navigate = useNavigate();

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const params = useParams({ strict: false }) as Record<string, any>;
	const variant = ( params.variant as string ) || 'pages';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const search = useSearch({ strict: false }) as Record<string, any>;

	const from        = ( search.from as string ) || '/';
	const allowed     = ( search.allowed as string ) || ( variant || 'pages' );
	const dataTableId = ( search.dataTableId as string ) || 'datatable';

	const allowedConfigs = useMemo(
		() => allowed.split( ',' ).filter( Boolean ),
		[ allowed ]
	);

	// Track the currently selected variant locally for instant switching.
	const [ selectedVariant, setSelectedVariant ] = useState( variant );

	// Controls the exit animation before the actual navigation fires.
	const [ isVisible, setIsVisible ] = useState( true );

	/**
	 * Handle variant change from the dropdown.
	 *
	 * @param {string} newVariant - The newly selected variant key.
	 */
	const handleVariantChange = useCallback( ( newVariant: string ) => {
		setSelectedVariant( newVariant );
	}, []);

	/**
	 * Close the overlay and navigate back to the source page, carrying the
	 * currently active filters and date range forward (Option B).
	 */
	const handleClose = useCallback( () => {
		setIsVisible( false );

		const closeSearch: Record<string, string | undefined> = {};

		// Carry active filter values forward.
		FILTER_KEYS.forEach( ( key ) => {
			const value = search[ key ];
			if ( value && '' !== value ) {
				closeSearch[ key ] = value;
			}
		});

		// Carry date range forward.
		if ( search.startDate ) {
			closeSearch.startDate = search.startDate;
		}
		if ( search.endDate ) {
			closeSearch.endDate = search.endDate;
		}
		if ( search.range ) {
			closeSearch.range = search.range;
		}

		setTimeout( () => {
			navigate({
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				to: from as any,
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				search: closeSearch as any
			});
		}, EXIT_DURATION_MS );
	}, [ navigate, from, search ]);

	// Close on Escape key.
	useEffect( () => {
		const handleKeyDown = ( e: KeyboardEvent ) => {
			if ( 'Escape' === e.key ) {
				handleClose();
			}
		};

		document.addEventListener( 'keydown', handleKeyDown );
		return () => document.removeEventListener( 'keydown', handleKeyDown );
	}, [ handleClose ]);

	// Prevent scroll on the body while overlay is open.
	useEffect( () => {
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = '';
		};
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

	return (
		<AnimatePresence>
			{ isVisible && (
				<motion.div
					id="datatable-overlay"
					className="fixed inset-0 left-0 max-[960px]:left-9 max-[782px]:left-0 z-9999 dark:bg-gray-400 bg-gray-700 bg-opacity-90 flex items-end justify-center px-4"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.15, ease: 'easeOut' }}
					onClick={ handleClose }
				>
					<motion.div
						initial={{ opacity: 0, y: 500, scale: 0.7 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: 500, scale: 0.7 }}
						transition={{
							delay: 0.1,
							y: {
								type: 'spring',
								stiffness: 135,
								damping: 18,
								mass: 0.45
							},
							opacity: {
								duration: 0.18,
								ease: 'easeOut'
							}
						}}
						className="w-full h-[95vh] max-h-[95vh] max-w-(--breakpoint-2xl)"
						onClick={ ( e ) => e.stopPropagation() }
					>
						<div className="h-full bg-gray-100 rounded-t-2xl shadow-2xl overflow-hidden flex flex-col">

							{/* Header: variant switcher, filters + date range, close button. */}
							<div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-gray-200 shrink-0">

								{/* Variant switcher. */}
								<div className="flex items-center gap-2 shrink-0">
									{ showDropdown ? (
										<Select.Root value={ selectedVariant } onValueChange={ handleVariantChange }>
											<Select.Trigger className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium shadow-sm transition-all cursor-pointer hover:border-gray-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1">
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

											<Select.Portal>
												<Select.Content
													className="z-99999 min-w-[200px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl animate-in fade-in-0 zoom-in-95"
													position="popper"
													sideOffset={ 6 }
													align="start"
												>
													<Select.Viewport className="p-1.5">
														{ variantOptions.map( ( option ) => (
															<Select.Item
																key={ option.key }
																value={ option.key }
																className="relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm cursor-pointer select-none transition-colors data-highlighted:bg-green-50 data-highlighted:outline-none data-[state=checked]:text-green-700 data-[state=checked]:font-medium"
															>
																<Icon
																	name={ option.icon }
																	size={ 16 }
																	color="gray"
																/>
																<Select.ItemText>
																	{ option.label }
																</Select.ItemText>
															</Select.Item>
														) )}
													</Select.Viewport>
												</Select.Content>
											</Select.Portal>
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
									)}
								</div>

								{/* Filters + date range. */}
								<div className="flex items-center gap-3 flex-wrap flex-1 justify-end">
									<ErrorBoundary>
										<PageFilter />
									</ErrorBoundary>

									<ErrorBoundary>
										<DateRange />
									</ErrorBoundary>
								</div>

								{/* Close button. */}
								<button
									type="button"
									className="shrink-0 bg-gray-100 border border-gray-400 focus:ring-blue-500 rounded-full p-2.5 transition-all duration-200 hover:bg-gray-400 hover:shadow-md focus:outline-hidden focus:ring-2 focus:ring-offset-2"
									onClick={ handleClose }
									aria-label={ __( 'Close', 'burst-statistics' ) }
								>
									<Icon name="times" />
								</button>
							</div>

						{/* Table area — fills remaining space, scrollable. */}
						<div className="flex flex-col flex-1 min-h-0 overflow-y-auto p-4 gap-4">
							<ErrorBoundary>
								<DataTableBlock
									allowedConfigs={ [ selectedVariant ] }
									id={ dataTableId }
									isInOverlay={ true }
								/>
							</ErrorBoundary>
						</div>
						</div>
					</motion.div>
				</motion.div>
			) }
		</AnimatePresence>
	);
};

export default DataTableOverlay;
