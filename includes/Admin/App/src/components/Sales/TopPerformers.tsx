/**
 * Top Performers Component.
 */
import getTopPerformers, { transformTopPerformersData } from "@/api/getTopPerformersData";
import { useDate } from "@/store/useDateStore";
import { useFiltersStore } from "@/store/useFiltersStore";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { __ } from "@wordpress/i18n";
import { Block } from "@/components/Blocks/Block";
import { BlockHeading } from "@/components/Blocks/BlockHeading";
import { BlockContent } from "@/components/Blocks/BlockContent";
import SelectInput from "@/components/Inputs/SelectInput";
import TopPerformerStats from "@/components/Sales/TopPerformersStats";

/**
 * Top Performers data interface.
 */
interface TopPerformersData {
    [key: string]: {
        title: string;
        subtitle: string;
        value: string;
        exactValue: number;
        change: string;
        changeStatus: string;
    };
}

const options = [
    {
        label: __( "Revenue", 'burst-statistics' ),
        value: "revenue"
    },
    {
        label: __( "Count", 'burst-statistics' ),
        value: "count"
    }
];

/**
 * Top Performers component.
 *
 * @return {JSX.Element} The Top Performers component.
 */
const TopPerformers = (): JSX.Element => {
    const { startDate, endDate, range } = useDate( ( state ) => state );
    const filters = useFiltersStore( ( state ) => state.filters );

    const [ selectedOption, setSelectedOption ] = useState( options[0].value );

    const { data: rawData } = useQuery(
        {
            queryKey: [ 'top-performers', startDate, endDate, range, filters ],
            queryFn: () => getTopPerformers( { startDate, endDate, range, filters } ),
            placeholderData: null,
            gcTime: 10000,
        }
    );

    const topPerformers = useMemo(
        () => ( rawData ? transformTopPerformersData( rawData, selectedOption ) : null ),
        [ rawData, selectedOption ]
    );

    const blockHeadingProps = {
        title: __( 'Top performers', 'burst-statistics' ),
        controls: (
            <div className="flex items-center gap-2.5">
                <SelectInput options={ options } value={ selectedOption } onChange={ setSelectedOption } />
            </div>
        )
    }

    return (
        <Block className="row-span-2 lg:col-span-6 xl:col-span-3">
            <BlockHeading { ...blockHeadingProps } />

            <BlockContent>
                {
                    topPerformers && Object.entries( topPerformers ).map( ( [ key, value ] ) => (
                        <TopPerformerStats
                            key={ key }
                            title={ value.title }
                            subtitle={ value.subtitle }
                            value={ value.value }
                            exactValue={ value.exactValue }
                            change={ value.change }
                            changeStatus={ value.changeStatus }
                        />
                    ) )
                }
            </BlockContent>
        </Block>
    )
}

export default TopPerformers;
