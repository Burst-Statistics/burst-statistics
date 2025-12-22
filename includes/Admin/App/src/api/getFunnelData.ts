import { FunnelStage } from '@/components/Sales/Funnel';
import { getData } from '@/utils/api';

interface GetFunnelArgs {
	startDate: string;
	endDate: string;
	range: string;
	filters: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
	selectedPages?: string[];
}

export async function getFunnelData(
	args: GetFunnelArgs
): Promise<FunnelStage[]> {
	const { startDate, endDate, range, filters, selectedPages } = args;

	const { data } = await getData(
		'ecommerce/sales-funnel',
		startDate,
		endDate,
		range,
		{
			filters,
			selectedPages
		}
	);

	return data;
}
