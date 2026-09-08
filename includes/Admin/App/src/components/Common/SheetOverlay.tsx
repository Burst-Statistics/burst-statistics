import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { __ } from '@wordpress/i18n';
import Icon from '@/utils/Icon';
import { PageFilter } from '@/components/Filters/PageFilter';
import DateRange from '@/components/Statistics/DateRange';
import ErrorBoundary from '@/components/Common/ErrorBoundary';
import { FILTER_KEYS } from '@/config/filterConfig';
import {
	SHEET_OVERLAY_PROPS,
	SHEET_PANEL_PROPS
} from '@/components/Common/sheetMotionProps';

// Duration in ms, matched to the exit spring animation.
const EXIT_DURATION_MS = 0;

type SheetOverlayProps = {
	title: React.ReactNode;
	overlayId?: string;
	children: React.ReactNode;
};

/**
 * SheetOverlay — shared full-screen bottom sheet shell.
 *
 * Provides backdrop motion, header chrome (title slot, filters, date range,
 * close button), escape/backdrop close, body scroll lock, and navigation
 * back to the source route with filter/date context preserved.
 *
 * @param {Object}          props           - Component props.
 * @param {React.ReactNode} props.title     - Title content rendered in the header.
 * @param {string}          props.overlayId - Optional DOM id for the overlay root.
 * @param {React.ReactNode} props.children  - Scrollable body content.
 * @return {JSX.Element} The sheet overlay component.
 */
export const SheetOverlay: React.FC<SheetOverlayProps> = ({
	title,
	overlayId = 'sheet-overlay',
	children
}) => {
	const navigate = useNavigate();

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const search = useSearch({ strict: false }) as Record<string, any>;

	const from = ( search.from as string ) || '/';

	// Controls the exit animation before the actual navigation fires.
	const [ isVisible, setIsVisible ] = useState( true );

	/**
	 * Close the overlay and navigate back to the source page, carrying the
	 * currently active filters and date range forward.
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

	const handleBackdropClick = useCallback( ( e: React.MouseEvent ) => {
		if ( e.target === e.currentTarget ) {
			handleClose();
		}
	}, [ handleClose ]);

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

	// The overlay is portaled to document.body (to escape stacking contexts of
	// the admin page), so the main app's dark mode class must be mirrored on
	// the portal wrapper.
	const [ isDark, setIsDark ] = useState( false );

	useEffect( () => {
		if ( ! isVisible ) {
			return;
		}
		const mainAppContainer = Array.from( document.querySelectorAll( '#burst-statistics' ) )
			.find( ( el ) => ! el.classList.contains( 'overlay-portal-wrapper' ) );
		if ( mainAppContainer ) {
			setIsDark( mainAppContainer.classList.contains( 'dark' ) );
		}
	}, [ isVisible ]);

	return createPortal(
		<div
			id="burst-statistics"
			className={ `burst overlay-portal-wrapper ${ isDark ? 'dark' : '' }` }
		>
			<AnimatePresence>
				{ isVisible && (
					<motion.div
						{...SHEET_OVERLAY_PROPS}
						id={ overlayId }
						onClick={ handleBackdropClick }
					>
						<motion.div
							{...SHEET_PANEL_PROPS}
						>
							<div className="h-full bg-gray-100 rounded-t-2xl shadow-2xl overflow-hidden flex flex-col">

								{/* Header: title, filters + date range, close button. */}
								<div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-gray-200 shrink-0">

									<div className="flex items-center gap-2 shrink-0">
										{ title }
									</div>

									<div className="hidden md:flex items-center justify-between flex-1 gap-3 min-w-0">
										<ErrorBoundary>
											<PageFilter />
										</ErrorBoundary>

										<ErrorBoundary>
											<DateRange />
										</ErrorBoundary>
									</div>

									<button
										type="button"
										className="shrink-0 bg-gray-100 border border-gray-400 focus:ring-blue-500 rounded-full p-2.5 transition-all duration-200 hover:bg-gray-400 hover:shadow-md focus:outline-hidden focus:ring-2 focus:ring-offset-2"
										onClick={ handleClose }
										aria-label={ __( 'Close', 'burst-statistics' ) }
									>
										<Icon name="times" />
									</button>
								</div>

								<div className="flex flex-col flex-1 min-h-0 overflow-y-auto p-4 gap-4">
									{ children }
								</div>
							</div>
						</motion.div>
					</motion.div>
				) }
			</AnimatePresence>
		</div>,
		document.body
	);
};
