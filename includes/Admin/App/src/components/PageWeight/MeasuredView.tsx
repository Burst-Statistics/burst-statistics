import { __ } from '@wordpress/i18n';
import { BlockContent } from '@/components/Blocks/BlockContent';
import { BarDataTable } from '@/components/DataTable/BarDataTable';
import useColumnsBySiteUrl from '@/hooks/useColumnsBySiteUrl';
import { getPageWeightColumns } from './columns';
import PageWeightSummary from './PageWeightSummary';
import type { PageWeightData } from './usePageWeightData';

type MeasuredViewProps = {

	/** The block payload. */
	data: PageWeightData;

	/** Whether the block's data request is in flight. */
	isLoading: boolean;
};

/**
 * The reported state: average page weight and the heaviest measured pages.
 *
 * @param {MeasuredViewProps} props - Component props.
 * @return {JSX.Element} The headline and table.
 */
const MeasuredView = ({ data, isLoading }: MeasuredViewProps ) => {
	const columns = useColumnsBySiteUrl( getPageWeightColumns );

	return (
		<>
			<PageWeightSummary
				avgBytes={data.avg_bytes}
				trend={data.weight_trend}
			/>

			<BlockContent className="px-0 py-0 overflow-y-auto">
				<BarDataTable
					columns={columns}
					data={data.rows}
					rowKey={( row ) => row.page_url as string}
					barColumnKey="page_weight"
					isLoading={isLoading}
					emptyState={
						__( 'No page weight measured yet.', 'burst-statistics' )
					}
				/>
			</BlockContent>
		</>
	);
};

export default MeasuredView;
