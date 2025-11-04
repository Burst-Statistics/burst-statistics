/**
 * Ghost Funnel Chart Component
 */
import { __ } from "@wordpress/i18n";
import { Block } from "@/components/Blocks/Block";
import { BlockHeading } from "@/components/Blocks/BlockHeading";
import { BlockContent } from "@/components/Blocks/BlockContent";
import React from "react";
import { ResponsiveFunnel } from "@nivo/funnel";

const GhostFunnelChart = (): JSX.Element => {
    const data = [
        {
            "id": "step_sent",
            "value": 66326,
            "label": __( "Sent", 'burst-statistics' )
        },
        {
            "id": "step_viewed",
            "value": 62516,
            "label": __( "Viewed", 'burst-statistics' )
        },
        {
            "id": "step_clicked",
            "value": 40538,
            "label": __( "Clicked", 'burst-statistics' )
        },
        {
            "id": "step_add_to_cart",
            "value": 25892,
            "label": __( "Add To Cart", 'burst-statistics' )
        },
        {
            "id": "step_purchased",
            "value": 17258,
            "label": __( "Purchased", 'burst-statistics' )
        }
    ];

    const blockHeadingProps = {
        title: __( 'Funnel', 'burst-statistics' ),
    }

    const blockContentProps = {
        className: 'p-0',
    }

    return (
        <Block className="row-span-2 overflow-hidden xl:col-span-6">
            <BlockHeading { ...blockHeadingProps } />

            <BlockContent {...blockContentProps}>
                <div className='h-96 border-t border-t-divider pt-4'>
                    <ResponsiveFunnel
                        data={data}
                        spacing={4}
                        margin={{
                            left: 0,
                            right: 0,
                            bottom: 140,
                            top: 50,
                        }}
                        shapeBlending={0.6}
                        valueFormat=">-.4~s"
                        direction='horizontal'
                        enableLabel={true}
                        enableBeforeSeparators={false}
                        enableAfterSeparators={false}
                        borderWidth={20}
                        labelColor='#fff'
                        currentPartSizeExtension={5}
                        animate={true}
                        borderColor={{
                            from: "color",
                            modifiers: [["brighter", 0.6]],
                        }}
                        interpolation="smooth"
                        colors='#2E8A37'
                        motionConfig="gently"
                        layers={[
                            'parts',
                            'labels',
                        ]}
                    />
                </div>
            </BlockContent>
        </Block>
    );
}

export default GhostFunnelChart;