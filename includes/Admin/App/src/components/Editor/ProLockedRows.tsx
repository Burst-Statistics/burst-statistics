import React from 'react';
import { __ } from '@wordpress/i18n';
import { burst_get_website_url } from '@/utils/lib';

/**
 * Locked rows shown in the Free version for Pro features, accompanied by
 * a prominent call-to-action to upgrade to Burst Pro.
 *
 * @return Container element with locked rows and upgrade button.
 */
export const ProLockedRows: React.FC = () => {
	const lockedFeatures = [
		__( 'How far people read', 'burst-statistics' ),
		__( 'Search queries', 'burst-statistics' ),
		__( 'Where they go next', 'burst-statistics' ),
		__( 'Revision impact', 'burst-statistics' )
	];

	const upgradeUrl = burst_get_website_url( 'pricing', {
		utm_source: 'plugin',
		utm_medium: 'editor-statistics'
	});

	return (
		<div className="flex flex-col border-t border-gray-200 pt-1">
			{ lockedFeatures.map( ( feature ) => (
				<a
					key={ feature }
					href={ upgradeUrl }
					target="_blank"
					rel="noopener noreferrer"
					className="flex items-center justify-between border-b border-gray-100 py-2.5 text-xs text-text-gray transition-colors hover:text-text-black"
				>
					<span>{ feature }</span>
					<span className="rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-black uppercase leading-none shadow-2xs">
						{ __( 'PRO', 'burst-statistics' ) }
					</span>
				</a>
			) ) }

			<div className="mt-4 mb-2">
				<a
					href={ upgradeUrl }
					target="_blank"
					rel="noopener noreferrer"
					className="flex w-full items-center justify-center rounded-md bg-[#256c35] px-4 py-2.5 text-center text-xs font-semibold text-white transition-colors hover:bg-green-800"
				>
					{ __( 'Unlock per-post insights', 'burst-statistics' ) }
				</a>
			</div>
		</div>
	);
};
