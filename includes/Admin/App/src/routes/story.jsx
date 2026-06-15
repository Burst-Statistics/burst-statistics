import { createFileRoute } from '@tanstack/react-router';
import {getAction} from '@/utils/api';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import React, {useEffect} from 'react';
import {StoryBlockWrapper} from '@/components/Reporting/ReportWizard/Preview/StoryBlockWrapper';
import {useReportConfigStore} from '@/store/reports/useReportConfigStore';
import {useWizardStore} from '@/store/reports/useWizardStore';
import Icon from '@/utils/Icon';
import {useReportsStore} from '@/store/reports/useReportsStore';
import useShareableLinkStore from '@/store/useShareableLinkStore';
import {__} from '@wordpress/i18n';

export const Route = createFileRoute( '/story' )({
    component: Story,
    errorComponent: ({ error }) => (
        <div className="text-red-500 p-4">
            {error.message || __( 'An error occurred loading the report', 'burst-statistics' )}
        </div>
    )
});

function Story() {
    const [ isWizardLoaded, setIsWizardLoaded ] = React.useState( false );
    const isPdfMode = useShareableLinkStore( ( state ) => state.isPdfMode );
    const availableContent = useReportConfigStore( ( state ) => state.availableContent );
    const getStartDate = useWizardStore( ( state ) => state.getStartDate );
    const getEndDate = useWizardStore( ( state ) => state.getEndDate );
    const reportBlocks = useWizardStore( ( state ) => state.wizard.content );
    const [ errorMessage, setErrorMessage ] = React.useState( '' );
    const setReports = useReportsStore( ( state ) => state.setReports );
    const loadReportIntoWizard = useReportsStore( ( state ) => state.loadReportIntoWizard );
    const queryClient = useQueryClient();
    const getShareTokenFromUrl = () => {
        const urlParams = new URLSearchParams( window.location.search );
        return urlParams.get( 'burst_share_token' );
    };

    const getReportData = async() => {
        const token = getShareTokenFromUrl();
        return getAction( 'story-report-data', { token });
    };

    const { data: reportData, isFetching, isError } = useQuery({
        queryKey: [ 'story-report-data' ],
        queryFn: () => getReportData()
    });

    // Load report into store and wizard when report data is fetched
    useEffect( () => {

        // Early returning here.
        if ( ! reportData?.report ) {
            return;
        }

        // if there's no id, there is a permissions issue, or it is not enabled. so we set error message here and then at the end setIsWizardLoaded( true ) will be set.
        if ( ! reportData?.report?.id ) {
            setErrorMessage( __( 'The report could not load. Check if the report is enabled.', 'burst-statistics' ) );
        }

        if ( reportData.report.id ) {

            // Seed settings fields with image URLs resolved server-side.
            // On the story/frontend page, settings fields are empty for the burst_viewer
            // user (capability check in PHP), so getValue('logo_attachment_id') returns
            // undefined. useAttachmentUrl uses a URL value directly instead of fetching
            // the attachment via wp.media, which is unavailable here.
            const seedSettingValue = ( settingId, value ) => {
                queryClient.setQueryData(
                    [ 'settings_fields' ],
                    ( oldData ) => {
                        const currentFields = Array.isArray( oldData ) ? oldData : [];
                        if ( currentFields.some( ( f ) => f.id === settingId ) ) {
                            return currentFields;
                        }
                        return [ ...currentFields, { id: settingId, value } ];
                    }
                );
            };

            if ( reportData.logo_url ) {
                seedSettingValue( 'logo_attachment_id', reportData.logo_url );
            }

            if ( reportData.logo_url_dark ) {
                seedSettingValue( 'logo_attachment_id_dark', reportData.logo_url_dark );
            }

            if ( reportData.hero_background_image_url ) {
                seedSettingValue( 'hero_background_image_attachment_id', reportData.hero_background_image_url );
            }

            if ( reportData.hero_background_image_url_dark ) {
                seedSettingValue( 'hero_background_image_attachment_id_dark', reportData.hero_background_image_url_dark );
            }

            if ( reportData.brand_color ) {
                seedSettingValue( 'brand_color', reportData.brand_color );
            }

            if ( undefined !== reportData.hero_color_overlay_enabled ) {
                seedSettingValue( 'hero_color_overlay_enabled', reportData.hero_color_overlay_enabled );
            }

            // Store the report in the reports array. Hero block shortcodes are already
            // resolved server-side (see Reports::story_report_data), so no JS resolution is needed.
            setReports([ reportData.report ]);

            // Load it into the wizard
            loadReportIntoWizard( reportData.report.id, false );
        }

        setIsWizardLoaded( true );
    }, [ reportData?.report, setReports, loadReportIntoWizard, queryClient, reportData?.logo_url, reportData?.logo_url_dark, reportData?.hero_background_image_url, reportData?.hero_background_image_url_dark, reportData?.brand_color, reportData?.hero_color_overlay_enabled ]);


    useEffect( () => {
        const urlParams = new URLSearchParams( window.location.search );
        if ( '1' === urlParams.get( 'autoprint' ) ) {
            const timer = setTimeout( () => {
                window.print();
            }, 1000 );
            return () => clearTimeout( timer );
        }
    }, [ reportBlocks ]);

    if ( isFetching || isError || ! isWizardLoaded || ! reportData?.report || ! Array.isArray( reportBlocks ) || 0 === reportBlocks.length ) {
        return (
            <div className="col-span-12 flex justify-center items-center p-8">
                <Icon name="loading" color="gray" />
            </div>
        );
    }

    if ( 0 < errorMessage.length ) {
        return (
            <div className="col-span-12 flex justify-center items-center p-8">
                <div className="text-red-500 text-center">
                    {errorMessage}
                </div>
            </div>
        );
    }

    const handlePrintPdf = () => {
        window.print();
    };

    //exit if reportData not loaded yet.
    if ( ! reportData.report.id ) {
        return null;
    }

    const brandColor = reportData?.brand_color;
    const customCss = reportData?.custom_css;

    return (
        <div className="burst-story-page relative flex w-full flex-col">

            { customCss && <style>{customCss}</style> }

            {
                brandColor && (
                    <div style={{ backgroundColor: brandColor, height: '13px' }} className="w-full" />
                )
            }

            {
                isPdfMode &&
                <div className="z-1 absolute inset-x-0 mx-auto max-w-[1200px] px-4 @md:px-8 flex justify-end pt-8 @max-md:hidden">
                    <button onClick={handlePrintPdf} className="print:hidden cursor-pointer flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 hover:border-gray-400 hover:bg-gray-50 text-text-gray font-medium rounded-lg shadow-sm hover:shadow transition-all duration-200">
                        <Icon name="download" size={18} />
                        <span>{__( 'Download PDF', 'burst-statistics' )}</span>
                    </button>
                </div>
            }

            {
                reportBlocks.map( ( block, index ) => {
                    const blockId = block.id;
                    const blockConfig = availableContent.find( item => item.id === blockId );

                    if ( ! blockConfig || ! blockConfig.component ) {
                        console.warn( `Block config not found for blockId: ${blockId}` );
                        return null;
                    }

                    const BlockComponent = blockConfig.component;
                    const componentProps = {
                        customFilters: block.filters ?? {},
                        reportBlockIndex: index,
                        startDate: getStartDate( index ),
                        endDate: getEndDate( index ),
                        ...( blockConfig?.blockProps || {}),
                        allowBlockFilters: false,
                        isReport: true
                    };

                    return (
                        <StoryBlockWrapper reportBlockIndex={index} blockId={blockId} key={`${blockId}-${index}`}>
                            <BlockComponent {...componentProps} />
                        </StoryBlockWrapper>
                    );
                })
            }

            {
                brandColor && (
                    <div style={{ backgroundColor: brandColor, height: '68px' }} className="w-full" />
                )
            }
        </div>
    );
}
