import { createFileRoute } from '@tanstack/react-router';
import {doAction} from '@/utils/api';
import {useQuery} from '@tanstack/react-query';
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
            {error.message ||
                'An error occurred loading sources'}
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

    const setReports = useReportsStore( ( state ) => state.setReports );
    const loadReportIntoWizard = useReportsStore( ( state ) => state.loadReportIntoWizard );
    const getShareTokenFromUrl = () => {
        const urlParams = new URLSearchParams( window.location.search );
        return urlParams.get( 'burst_share_token' );
    };

    const getReportData = async() => {
        const token = getShareTokenFromUrl();
        const data = {
            token: token
        };
        return doAction( 'report/data', data );
    };

    const { data: reportData, isFetching, isError } = useQuery({
        queryKey: [ 'report-data' ],
        queryFn: () => getReportData()
    });

    // Load report into store and wizard when report data is fetched
    useEffect( () => {
        if ( reportData?.report ) {

            // Store the report in the reports array
            setReports([ reportData.report ]);

            // Load it into the wizard
            loadReportIntoWizard( reportData.report.id, false );
            setIsWizardLoaded( true );
        }
    }, [ reportData?.report, setReports, loadReportIntoWizard ]);


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

    const handlePrintPdf = () => {
        window.print();
    };

    //exit if reportData not loaded yet.
    if ( ! reportData.report.id ) {
        return null;
    }

    return (
        <div className="col-span-12 flex flex-col">
            {isPdfMode && <div className="flex justify-end">
                <button onClick={handlePrintPdf} className=" print:hidden flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 hover:border-gray-400 text-gray-700 hover:text-gray-900 font-medium rounded-lg shadow-sm hover:shadow transition-all duration-200">
                    <Icon name="download" size={18} />
                    <span>{__( 'Download PDF', 'burst-statistics' )}</span>
                </button>
            </div>}
            {
                reportBlocks.map( ( block, index ) => {
                    const blockId = block.id;
                    const blockConfig = availableContent.find( item => item.id === blockId );

                    // Skip if block config or component not found
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
                            <StoryBlockWrapper
                                reportBlockIndex={index}
                                key={`${blockId}-${index}`}
                            >
                                <BlockComponent {...componentProps} />
                            </StoryBlockWrapper>
                    );
                })
            }
        </div>
    );
}
