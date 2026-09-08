import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import clsx from 'clsx';
import Icon from '@/utils/Icon';

interface PageSummaryPreviewProps {
	pageUrl: string;
}

/**
 * Appends a query parameter to a URL string.
 *
 * @param url   - Target URL string.
 * @param key   - Query param name.
 * @param value - Query param value.
 * @return URL string with parameter appended.
 */
const addQueryParam = ( url: string, key: string, value: string ): string => {
	if ( ! url ) {
		return '';
	}
	try {
		const parsed = new URL( url, window.location.origin );
		parsed.searchParams.set( key, value );
		return parsed.toString();
	} catch {
		const separator = url.includes( '?' ) ? '&' : '?';
		return `${ url }${ separator }${ key }=${ value }`;
	}
};

/**
 * Renders a progressively loaded, non-interactive preview of the selected page.
 * Handles loading timeouts, connection errors, and security header restrictions
 * gracefully with a clean skeleton fallback.
 *
 * @param props - Component properties.
 * @param props.pageUrl - Absolute page URL to preview.
 * @return The scaled page preview.
 */
export const PageSummaryPreview = ({
	pageUrl
}: PageSummaryPreviewProps ): JSX.Element => {
	const [ loadedPageUrl, setLoadedPageUrl ] = useState( '' );
	const [ hasError, setHasError ] = useState( false );

	const hasPageUrl = '' !== pageUrl;
	const isPreviewLoaded = hasPageUrl && loadedPageUrl === pageUrl && ! hasError;
	const isLoading = hasPageUrl && ! isPreviewLoaded && ! hasError;
	const nonce = window.burst_settings?.burst_nonce || window.burst_settings?.nonce;
	let iframePreviewSrc = addQueryParam( pageUrl, 'burst_preview', '1' );
	iframePreviewSrc = addQueryParam( iframePreviewSrc, 'burst_force_logged_out', '1' );
	if ( nonce ) {
		iframePreviewSrc = addQueryParam( iframePreviewSrc, 'nonce', nonce );
	}

	// Reset error and loaded states when target page URL changes.
	useEffect( () => {
		setLoadedPageUrl( '' );
		setHasError( false );
	}, [ pageUrl ]);

	// Fallback timeout for host connection blocks, cross-origin blocks, or X-Frame-Options.
	useEffect( () => {
		if ( ! hasPageUrl || isPreviewLoaded || hasError ) {
			return;
		}

		const timeoutId = setTimeout( () => {
			setHasError( true );
		}, 12000 );

		return () => clearTimeout( timeoutId );
	}, [ pageUrl, hasPageUrl, isPreviewLoaded, hasError ]);

	return (
		<div
			className="relative h-[174px] w-[278px] max-w-full shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
			aria-busy={isLoading}
		>
			{/* Skeleton loading indicator */}
			{isLoading && (
				<div
					className="absolute inset-0 z-10 animate-pulse bg-gray-100"
					aria-label={__( 'Loading page preview', 'burst-statistics' )}
				>
					<div className="h-9 bg-gray-200" />
					<div className="space-y-2 px-4 pt-4">
						<div className="h-2.5 w-3/4 rounded bg-gray-200" />
						<div className="h-2.5 w-5/6 rounded bg-gray-200" />
						<div className="h-2.5 w-2/3 rounded bg-gray-200" />
					</div>
				</div>
			)}

			{/* Fallback skeleton layout if connection blocked / error occurs */}
			{hasError && (
				<div className="absolute inset-0 flex flex-col justify-between bg-gray-50 p-4">
					<div className="space-y-2.5">
						<div className="flex items-center gap-2">
							<div className="h-3 w-3 rounded-full bg-gray-300" />
							<div className="h-2.5 w-24 rounded bg-gray-300" />
						</div>
						<div className="h-2.5 w-3/4 rounded bg-gray-200" />
						<div className="h-2.5 w-1/2 rounded bg-gray-200" />
					</div>
					<div className="flex items-center justify-between border-t border-gray-200/80 pt-2 text-xs text-text-gray">
						<span>{__( 'Preview unavailable', 'burst-statistics' )}</span>
					</div>
				</div>
			)}

			{/* Non-interactive sandboxed iframe */}
			{hasPageUrl && ! hasError && (
				<iframe
					src={iframePreviewSrc}
					title={__( 'Preview of the selected page', 'burst-statistics' )}
					loading="lazy"
					sandbox="allow-same-origin allow-scripts"
					tabIndex={-1}
					onLoad={() => setLoadedPageUrl( pageUrl )}
					onError={() => setHasError( true )}
					className={clsx(
						'pointer-events-none h-[750px] w-[1200px] origin-top-left scale-[0.232] border-0 transition-opacity duration-300',
						isPreviewLoaded ? 'opacity-100' : 'opacity-0'
					)}
				/>
			)}

			{/* Visit Page overlay link */}
			{( isPreviewLoaded || hasError ) && hasPageUrl && (
				<a
					href={pageUrl}
					target="_blank"
					rel="noopener noreferrer"
					className={clsx(
						'group absolute inset-0 z-20 flex items-center justify-center transition-colors focus-visible:bg-black/20 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
						hasError ? 'bg-black/0 hover:bg-black/10' : 'bg-black/0 hover:bg-black/20'
					)}
					aria-label={__( 'Visit page', 'burst-statistics' )}
				>
					<span className="inline-flex items-center gap-1.5 rounded-md bg-white/90 px-3 py-2 text-sm font-medium text-text-black opacity-0 shadow-xs transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
						{__( 'Visit page', 'burst-statistics' )}
						<Icon name="external-link" size={14} />
					</span>
				</a>
			)}
		</div>
	);
};
