import React from 'react';
import { __ } from '@wordpress/i18n';
import { getFlowLegendItems } from './flowColors';
import { FlowTypeIcon } from './FlowTypeIcon';

/**
 * Renders the compact visitor-flow category legend with icons.
 *
 * @return Colour, icon, and category legend.
 */
export const VisitorFlowLegend: React.FC = () => {
	const legendItems = getFlowLegendItems();

	return (
		<div
			className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-text-gray"
			aria-label={__( 'Visitor flow legend', 'burst-statistics' )}
		>
			{legendItems.map( ( item ) => (
				<span key={item.id} className="inline-flex items-center gap-1.5">
					<FlowTypeIcon type={item.type} size={12} />
					{item.label}
				</span>
			) )}
		</div>
	);
};
