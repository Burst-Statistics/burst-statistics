import {useDate} from '@/store/useDateStore';
import useFilters from '@/hooks/useFilters';
import {BlockComponentProps} from '@/store/reports/types';

export const useBlockConfig = ( props:BlockComponentProps ) => {
    const dateState = useDate( ( state ) => state );
    const { filters: defaultFilters } = useFilters( props.reportBlockIndex );

    return {
        isStory: props.startDate !== undefined,
        startDate: props.startDate ?? dateState.startDate,
        endDate: props.endDate ?? dateState.endDate,
        range: dateState.range,
        filters: props.customFilters ?? defaultFilters,
        allowedConfigs: props.allowedConfigs ?? [ 'pages', 'referrers' ],
        id: props.id ?? 'datatable',
        index: props.reportBlockIndex ?? undefined,
        isEcommerce: props.isEcommerce ?? false,
        allowBlockFilters: props.allowBlockFilters ?? true,
        isReport: props.isReport ?? false
    };
};
