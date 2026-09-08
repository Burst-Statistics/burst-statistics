import type { ComponentType } from 'react';
import { __ } from '@wordpress/i18n';
import { PerPage } from '@/components/Pages/PerPage';

export type PageOverlayDefinition = {
	title: string;
	icon?: string;
	component: ComponentType;
};

export const PAGE_OVERLAYS: Record<string, PageOverlayDefinition> = {
	'1': {
		title: __( 'Per page', 'burst-statistics' ),
		icon: 'page',
		component: PerPage
	}
};

/**
 * Resolve a page overlay definition by ID.
 * Defaults to PerPage for any page ID.
 *
 * @param {string} id - The page overlay route ID.
 * @return {PageOverlayDefinition} The resolved page definition.
 */
export const getPageOverlay = ( id: string ): PageOverlayDefinition => {
	return PAGE_OVERLAYS[ id ] || {
		title: __( 'Per page', 'burst-statistics' ),
		icon: 'page',
		component: PerPage
	};
};
