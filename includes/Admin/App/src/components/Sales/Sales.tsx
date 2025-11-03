/**
 * Sales Component.
 */
import { useDate } from "@/store/useDateStore";
import { useFiltersStore } from "@/store/useFiltersStore";
import { useQuery } from "@tanstack/react-query";
import { __ } from "@wordpress/i18n";
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import getSales from "@/api/getSalesData";
import {BlockFooter} from "@/components/Blocks/BlockFooter";
import SalesFooter from "@/components/Sales/SalesFooter";
import ExplanationAndStatsItem from "@/components/Common/ExplanationAndStatsItem";

/**
 * Sales data interface.
 */
interface SalesData {
    [key: string]: {
        title: string;
        subtitle: string;
        value: string;
        exactValue: number;
        change: string;
        changeStatus: string;
        icon?: string | null;
    }
}

/**
 * Sales component.
 *
 * @return {JSX.Element} The Sales component.
 */
const Sales = (): JSX.Element => {
    const { startDate, endDate, range } = useDate( ( state ) => state );
    const filters = useFiltersStore( ( state ) => state.filters );

    const salesQuery = useQuery< SalesData | null >(
        {
            queryKey: [ 'sales', startDate, endDate, range, filters ],
            queryFn: () => getSales( { startDate, endDate, range, filters } ),
            placeholderData: null,
            gcTime: 10000
        }
    );

    const sales = salesQuery.data || null;

    const blockHeadingProps = {
        title: __( 'Sales', 'burst-statistics' ),
    }

    return (
        <Block className="row-span-2 lg:col-span-6 xl:col-span-3">
            <BlockHeading { ...blockHeadingProps } />

            <BlockContent>
                {
                    sales && Object.entries( sales ).map( ( [ key, value ] ) => {
                        return (
                            <ExplanationAndStatsItem
                                { ...(value.icon && { iconKey: value.icon }) }
                                key={ key }
                                title={ value.title }
                                subtitle={ value.subtitle }
                                value={ value.value }
                                exactValue={ value.exactValue }
                                change={ value.change }
                                changeStatus={ value.changeStatus }
                            />
                        );
                    } )
                }
            </BlockContent>

            <BlockFooter>
                <SalesFooter
                    startDate={startDate}
                    endDate={endDate}
                />
            </BlockFooter>
        </Block>
    )
}

export default Sales;
