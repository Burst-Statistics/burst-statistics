import { __ } from '@wordpress/i18n';
import PopoverFilter from '@/components/Common/PopoverFilter';

/**
 * Revenue/Sales mode popover shared by the ecommerce chart blocks. The id
 * keeps each block's popover state separate.
 *
 * @param props - Popover id, active mode and apply handler.
 * @return The popover filter.
 */
export function ChartModeFilter({
	id,
	chartMode,
	onApply
}: {
	id: string;
	chartMode: 'revenue' | 'sales';
	onApply: ( mode: string ) => void;
}): JSX.Element {
	return (
		<PopoverFilter
			id={ id }
			selectedOptions={ [ chartMode ] }
			options={{
				revenue: {
					label: __( 'Revenue', 'burst-statistics' ),
					default: true
				},
				sales: {
					label: __( 'Sales', 'burst-statistics' )
				}
			}}
			selectionMode="single"
			onApply={ ( selected: string[]) => onApply( selected?.[ 0 ] ?? 'revenue' ) }
		/>
	);
}
