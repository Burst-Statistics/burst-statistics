/**
 * Sales Component.
 */

import { useQuery } from '@tanstack/react-query';
import { __ } from '@wordpress/i18n';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import getSales from '@/api/getSalesData';
import { BlockFooter } from '@/components/Blocks/BlockFooter';
import SalesFooter from '@/components/Sales/SalesFooter';
import ExplanationAndStatsItem from '@/components/Common/ExplanationAndStatsItem';
import {useBlockConfig} from '@/hooks/useBlockConfig';
import {BlockComponentProps} from '@/store/reports/types';

/**
 * Sales data interface.
 */
interface SalesData {
	[key: string]: {
		title: string;
		subtitle: string | null;
		value: string;
		exactValue: number | null;
		change: string | null;
		changeStatus: string | null;
		icon?: string | null;
		tooltipText: string | null;
	};
}

/**
 * Sales component.
 *
 * @return {JSX.Element} The Sales component.
 */
const Sales = ( props:BlockComponentProps ): JSX.Element => {
	const { startDate, endDate, range, filters, index } = useBlockConfig( props );

	const placeholderData: SalesData = {
		'conversion-rate': {
			title: __( 'Conversion Rate', 'burst-statistics' ),
			value: '-',
			exactValue: null,
			subtitle: '-',
			changeStatus: null,
			change: '-',
			icon: 'eye',
			tooltipText: null
		},
		'abandonment-rate': {
			title: __( 'Abandoned Carts', 'burst-statistics' ),
			value: '-',
			exactValue: null,
			subtitle: '-',
			changeStatus: null,
			change: '-',
			icon: 'sessions',
			tooltipText: null
		},
		'average-order': {
			title: __( 'Average Order Value', 'burst-statistics' ),
			value: '-',
			exactValue: null,
			subtitle: '-',
			changeStatus: null,
			change: '-',
			icon: 'visitors',
			tooltipText: null
		},
		revenue: {
			title: __( 'Revenue', 'burst-statistics' ),
			value: '-',
			exactValue: null,
			subtitle: '-',
			changeStatus: null,
			change: '-',
			icon: 'log-out',
			tooltipText: null
		}
	};

	const salesQuery = useQuery<SalesData | null>({
		queryKey: [ 'sales', startDate, endDate, range, filters ],
		queryFn: () => getSales({ startDate, endDate, range, filters }),
		placeholderData,
		gcTime: 10000
	});

	const sales = salesQuery.data || null;

	const blockHeadingProps = {
		title: __( 'Sales', 'burst-statistics' ),
		isReport: props.isReport,
		reportBlockIndex: index
	};

	return (
		<Block className="row-span-2 lg:col-span-6 xl:col-span-3 block-sales">
			<BlockHeading {...blockHeadingProps} />

			<BlockContent>
				{sales &&
					Object.entries( sales ).map( ([ key, value ]) => {
						return (
							<ExplanationAndStatsItem
								{...( value.icon && { iconKey: value.icon })}
								key={key}
								title={value.title}
								subtitle={value.subtitle}
								value={value.value}
								exactValue={value.exactValue}
								change={value.change}
								changeStatus={value.changeStatus}
								tooltipText={value.tooltipText}
								className={key}
							/>
						);
					})}
			</BlockContent>

			<BlockFooter>
				<SalesFooter startDate={startDate} endDate={endDate} />
			</BlockFooter>
		</Block>
	);
};

export default Sales;
