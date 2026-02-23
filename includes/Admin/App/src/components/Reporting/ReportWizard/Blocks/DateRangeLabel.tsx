import React from 'react';
import {useWizardStore} from '@/store/reports/useWizardStore';
import {getDisplayDates} from '@/utils/formatting';
const DateRangeLabel = ({index = -1, isBlock = false}) => {
    const blockDateRangeEnabled = useWizardStore( ( state ) => state.blockDateRangeEnabled );
    const getStartDate = useWizardStore( ( state ) => state.getStartDate );
    const getEndDate = useWizardStore( ( state ) => state.getEndDate );
    if ( isBlock && ! blockDateRangeEnabled( index ) ) {
        return null;
    }
    const { startDate, endDate } = getDisplayDates( getStartDate( index ), getEndDate( index ) );

    if ( isBlock ) {
        return (
            <div className="flex items-center gap-2 justify-end mt-2">
                {startDate} - {endDate}
            </div>
        );
    }
    return (
        <div className="text-gray-700 text-md font-bold mb-2 text-center">
        {startDate} - {endDate}
        </div>
    );
};
export default DateRangeLabel;
