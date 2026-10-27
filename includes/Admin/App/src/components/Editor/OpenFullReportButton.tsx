import React from 'react';
import { __ } from '@wordpress/i18n';
import { ExternalLink } from 'lucide-react';

export interface OpenFullReportButtonProps {
	id: string | number;
	pageUrl: string;
	range?: string;
	startDate: string;
	endDate: string;
}

/**
 * Renders the "Open full page report ↗" link button at the bottom of the panel.
 *
 * @param props           - Component properties.
 * @param props.id        - Post ID.
 * @param props.pageUrl   - Permalink path.
 * @param props.range     - Period range key.
 * @param props.startDate - Start date string.
 * @param props.endDate   - End date string.
 * @return Link button element.
 */
export const OpenFullReportButton: React.FC<OpenFullReportButtonProps> = ({
	id,
	pageUrl,
	range = 'last-30-days',
	startDate,
	endDate
}) => {
	const href = `admin.php?page=burst#/page/${ id }?pageUrl=${ encodeURIComponent( pageUrl ) }&range=${ encodeURIComponent( range ) }&startDate=${ startDate }&endDate=${ endDate }`;

	return (
		<div className="mt-4 pt-2">
			<a
				href={ href }
				target="_blank"
				rel="noopener noreferrer"
				className="flex w-full items-center justify-center gap-1.5 rounded-md border border-green-700 bg-white py-2 px-3 text-xs font-semibold text-green-700 transition-colors hover:bg-green-50"
			>
				<span>{ __( 'Open full page report', 'burst-statistics' ) }</span>
				<ExternalLink size={ 13 } className="shrink-0 text-green-700" />
			</a>
		</div>
	);
};
