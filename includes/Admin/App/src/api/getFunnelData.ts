import { FunnelStage } from "@/components/Sales/Funnel";
import {getData} from "@/utils/api";

interface GetFunnelArgs {
    startDate: string;
    endDate: string;
    range: string;
    filters: Record<string, any>;
    selectedPages?: string[];
}

export async function getFunnelData(args: GetFunnelArgs): Promise<FunnelStage[]> {
    const { startDate, endDate, range, filters, selectedPages } = args;

    const { data } = await getData( 'ecommerce/sales-funnel', startDate, endDate, range, {
        filters,
        selectedPages: selectedPages,
    });

    return data;
}
