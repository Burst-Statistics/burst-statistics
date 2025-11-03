import React from "react";
import Icon from "@/utils/Icon";
import * as Popover from '@radix-ui/react-popover';
import { useState } from 'react';
import { __ } from "@wordpress/i18n";
import RadioInput from "@/components/Inputs/RadioInput";
import { useFunnelStore } from "@/store/useFunnelStore";
import SelectPageField from "@/components/Fields/SelectPageField";
import ButtonInput from "@/components/Inputs/ButtonInput";

/**
 * Funnel Chart Header component
 */
export const FunnelChartHeader: React.FC = () => {
    const [ isOpen, setIsOpen ] = useState( false );
    const pageSettings = useFunnelStore( ( state ) => state.pageSettings );
    const setPageSettings = useFunnelStore( ( state ) => state.setPageSettings );
    const setSelectedPages = useFunnelStore( ( state ) => state.setSelectedPages );
    const selectedPages = useFunnelStore( ( state ) => state.selectedPages );
    const [ pageSettingsLocal, setPageSettingsLocal ] = useState( pageSettings );
    const [ selectedPagesLocal, setSelectedPagesLocal ] = useState( selectedPages );
    const field = {
        id: 'pageFilter',
        label: __( 'Product Pages', 'burst-statistics' ),
        value: selectedPagesLocal,
    };

    /**
     * Open or close the popover
     *
     * @param {boolean} open - Whether to open or close the popover
     */
    const openOrClosePopover = ( open: boolean ) => {
        setIsOpen( open );

        // Reset all the changes made but are not applied.
        if ( ! open ) {
            setPageSettingsLocal( pageSettings );
            setSelectedPagesLocal( selectedPages );
        }
    };

    /**
     * Handle applying the filter settings
     */
    const handleApply = () => {
        setPageSettings( pageSettingsLocal );
        setSelectedPages( selectedPagesLocal );
        setIsOpen( false );
    }

    return (
        <Popover.Root open={ isOpen } onOpenChange={ openOrClosePopover }>
            <Popover.Trigger onClick={ () => setIsOpen( ! isOpen ) } asChild>
                 <div className={`${ isOpen ? 'bg-gray-300 shadow-lg' : 'bg-gray-200 shadow-sm'} border border-gray-300 focus:ring-blue-500 cursor-pointer rounded-full p-2.5 transition-all duration-200 hover:bg-gray-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2` }>
                    <Icon name="filter" />
                </div>
            </Popover.Trigger>

            <Popover.Content
                className="z-50 min-w-[320px] max-w-[400px] rounded-lg border border-gray-200 bg-white p-0 shadow-xl"
                align="end"
                sideOffset={10}
                arrowPadding={10}
            >
                <Popover.Arrow className="fill-white drop-shadow-sm" />

                 <div className="border-b border-gray-100 px-4 py-3">
                     <h5 className="m-0 text-base font-semibold text-black">
                         { __( 'Product pages', 'burst-statistics' ) }
                     </h5>
                 </div>

                <div className="max-h-[80vh] overflow-y-auto px-4 py-4">
                    <div className="mb-6">
                        <label className="mb-3 block text-sm font-medium text-gray">
                            { __( 'Select pages', 'burst-statistics' ) }
                        </label>

                        <RadioInput
                            id='pages_all'
                            name="pages_selection"
                            label={ __( 'All product pages', 'burst-statistics' ) }
                            value='all'
                            checked={ pageSettingsLocal === 'all' }
                            onChange={ () => {
                                setPageSettingsLocal( 'all' );
                                setSelectedPagesLocal( [] );
                            } }
                        />

                        <RadioInput
                            id='pages_specific'
                            name="pages_selection"
                            label={ __( 'Custom product pages', 'burst-statistics' ) }
                            value='specific'
                            checked={ pageSettingsLocal === 'custom' }
                            onChange={ () => {
                                setPageSettingsLocal( 'custom' );
                                setSelectedPagesLocal( [] );
                            }}
                        />

                        {
                            pageSettingsLocal === 'custom' ? (
                                <SelectPageField
                                    // @ts-ignore
                                    field={field}
                                    fullWidthContent={true}
                                    maxSelections={ 10 }
                                    onChange={ ( value: string | string[] ) => {
                                        if ( ! Array.isArray( value ) ) {
                                            setSelectedPagesLocal( [ value ] );
                                        } else {
                                            setSelectedPagesLocal( value );
                                        }
                                    }}
                                />
                            ) : null
                        }
                    </div>
                </div>

                <div className="rounded-b-lg border-t border-gray-100 bg-gray-50 px-4 py-3">
                    <div className="space-y-2">
                        <div className="flex gap-2">
                            <ButtonInput
                                onClick={ handleApply }
                                btnVariant="primary"
                                size="sm"
                                className="flex-1"
                            >
                                { __( 'Apply', 'burst-statistics' ) }
                            </ButtonInput>

                            <ButtonInput
                                onClick={ () => {
                                    setPageSettingsLocal( 'all' );
                                    setSelectedPagesLocal( [] );
                                    setIsOpen( false );
                                }}
                                btnVariant="tertiary"
                                size="sm"
                                className="flex-1"
                            >
                                { __( 'Reset to defaults', 'burst-statistics' ) }
                            </ButtonInput>
                        </div>
                    </div>
                </div>
            </Popover.Content>
        </Popover.Root>
    );
}