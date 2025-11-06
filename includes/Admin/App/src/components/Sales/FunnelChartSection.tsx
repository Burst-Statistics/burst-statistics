import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useDate } from "@/store/useDateStore";
import { useFiltersStore } from "@/store/useFiltersStore";
import { getFunnelData } from "@/api/getFunnelData";
import { __ } from "@wordpress/i18n";
import { Block } from "@/components/Blocks/Block";
import { BlockContent } from "@/components/Blocks/BlockContent";
import { BlockHeading } from "@/components/Blocks/BlockHeading";
import { FunnelChartHeader } from "@/components/Sales/FunnelChartHeader";
import { useFunnelStore } from "@/store/useFunnelStore";
import { FunnelChart, FunnelStage } from "./Funnel";

/**
 * FunnelChartSection component to fetch and display the funnel chart within a block.
 *
 * @return {JSX.Element} The FunnelChartSection component.
 */
const FunnelChartSection: React.FC = () => {
    const { startDate, endDate, range } = useDate( ( state ) => state );
    const filters = useFiltersStore( ( state ) => state.filters );
    const selectedPages = useFunnelStore( ( state ) => state.selectedPages );

    const funnelQuery = useQuery<FunnelStage[] | null>({
        queryKey: ["funnelData", startDate, endDate, range, filters, selectedPages],
        queryFn: () => getFunnelData({ startDate, endDate, range, filters, selectedPages }),
        placeholderData: null,
        gcTime: 10000,
    });

    const data = funnelQuery.data;

    const blockHeadingProps = {
        title: __('Funnel', 'burst-statistics'),
        controls: <FunnelChartHeader />,
    };

    const blockContentProps = {
        className: 'p-0',
    };

    return (
        <Block className="row-span-2 xl:col-span-6 z-[1]">
            <BlockHeading {...blockHeadingProps} />

            <BlockContent {...blockContentProps}>
                {funnelQuery.isFetching ? (
                    <div className="flex items-center justify-center h-96">
                        {__("Loading...", "burst-statistics")}
                    </div>
                ) : !data || data.length === 0 ? (
                    <div className="flex items-center justify-center h-96 text-gray-500">
                        {__("No data available for the selected period.", "burst-statistics")}
                    </div>
                ) : (
                    <FunnelChart data={data} />
                )}
            </BlockContent>
        </Block>
    );
};

export default FunnelChartSection;
