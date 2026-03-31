import React from 'react';
import { __ } from '@wordpress/i18n';
import HelpTooltip from '@/components/Common/HelpTooltip';

/**
 * Map of plugin version → ISO 8601 release date (YYYY-MM-DD).
 * Add a new entry here when releasing a version with new features.
 */
const VERSION_RELEASE_DATES: Record<string, string> = {
	'3.2.3': '2026-03-16'
};

interface NewBadgeProps {

	/**
	 * The plugin version in which the feature was introduced (e.g. '3.2.3').
	 */
	version: string;

	/**
	 * Number of days after the release date to keep showing the badge.
	 */
	days: number;

	/**
	 * Optional tooltip content shown next to the badge.
	 */
	tooltipContent?: string;

	/** Additional CSS classes */
	className?: string;
}

/**
 * NewBadge
 *
 * Shows a "New" badge for `days` days after a feature's release date.
 * Once the window passes the badge is hidden automatically.
 */
const NewBadge: React.FC<NewBadgeProps> = ({
	version,
	days,
	tooltipContent,
	className = ''
}) => {
	const releaseDate = VERSION_RELEASE_DATES[ version ];
	if ( ! releaseDate ) {
		return null;
	}

	const diffDays = ( new Date().getTime() - new Date( releaseDate ).getTime() ) / ( 1000 * 60 * 60 * 24 );

	if ( diffDays > days ) {
		return null;
	}

	const badge = (
		<span className={`inline-flex items-center gap-1 rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 ${className}`}>
			{__( 'New', 'burst-statistics' )}
		</span>
	);

	if ( tooltipContent ) {
		return (
			<HelpTooltip content={tooltipContent}>{badge}</HelpTooltip>
		);
	}

	return badge;
};

export default NewBadge;
