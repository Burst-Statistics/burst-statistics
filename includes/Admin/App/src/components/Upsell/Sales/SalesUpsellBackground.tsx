import ErrorBoundary from "@/components/Common/ErrorBoundary";
import { PageFilter } from "@/components/Statistics/PageFilter";
import DateRange from "@/components/Statistics/DateRange";
import DataTableBlock from "@/components/Statistics/DataTableBlock";
import Sales from "@/components/Sales/Sales";
import TopPerformers from "@/components/Sales/TopPerformers";
import QuickWins from "@/components/Sales/QuickWins";
import GhostFunnelChart from "@/components/Upsell/Sales/GhostFunnelChart";

const SalesUpsellBackground = (props: any) => {
    return (
        <>
            <div className="col-span-12 flex items-center justify-between">
                <ErrorBoundary>
                    <PageFilter />
                </ErrorBoundary>

                <ErrorBoundary>
                    <DateRange />
                </ErrorBoundary>
            </div>

            <ErrorBoundary>
                <GhostFunnelChart />
            </ErrorBoundary>

            <ErrorBoundary>
				<Sales />
			</ErrorBoundary>

			<ErrorBoundary>
				<TopPerformers />
			</ErrorBoundary>

			<ErrorBoundary>
				<QuickWins />
			</ErrorBoundary>

            <ErrorBoundary>
                <DataTableBlock allowedConfigs={["pages"]} id={99} />
            </ErrorBoundary>
        </>
    );
};

export default SalesUpsellBackground;
