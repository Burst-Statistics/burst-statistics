import React from 'react';
import { notFound, useParams } from '@tanstack/react-router';
import Icon from '@/utils/Icon';
import ErrorBoundary from '@/components/Common/ErrorBoundary';
import { SheetOverlay } from '@/components/Common/SheetOverlay';
import { getPageOverlay } from '@/config/pageOverlayConfig';

/**
 * PageOverlay — full-screen bottom sheet for custom page content.
 *
 * Opened via the /page/$id route. Resolves content from pageOverlayConfig
 * and renders it inside the shared SheetOverlay chrome.
 *
 * @return {JSX.Element} The page overlay component.
 */
export const PageOverlay: React.FC = () => {
	const { id = '' } = useParams({ strict: false });

	const pageDefinition = getPageOverlay( id );

	if ( ! pageDefinition ) {
		throw notFound();
	}

	const PageContent = pageDefinition.component;

	const title = (
		<div className="flex items-center gap-2 px-1">
			{ pageDefinition.icon && (
				<Icon
					name={ pageDefinition.icon }
					size={ 16 }
					color="gray"
				/>
			) }
			<h2 className="text-lg font-semibold m-0">
				{ pageDefinition.title }
			</h2>
		</div>
	);

	return (
		<SheetOverlay title={ title } overlayId="page-overlay">
			<ErrorBoundary>
				<PageContent />
			</ErrorBoundary>
		</SheetOverlay>
	);
};
