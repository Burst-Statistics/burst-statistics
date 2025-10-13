import { useEffect, useState } from 'react';
import ButtonInput from '../Inputs/ButtonInput';
import { __ } from '@wordpress/i18n';
import Popover from './Popover';
import {useFiltersStore} from "@/store/useFiltersStore";
import useFiltersData from "@/hooks/useFiltersData";
import SelectPageField from "@/components/Fields/SelectPageField";
import useLicenseStore from "@/store/useLicenseStore";

const AdvancedFilter = ({
                            isOpen,
                            setIsOpen,
                       }) => {
    const setFilters = useFiltersStore(state => state.setFilters);
    const getActiveFilters = useFiltersStore(state => state.getActiveFilters);
    const clearAllFilters = useFiltersStore(state => state.clearAllFilters);
    const deleteFilter = useFiltersStore(state => state.deleteFilter);
    const [tempFilters, setTempFilters] = useState({});
    const filtersConf = useFiltersStore(state => state.filtersConf);
    const { getFilterOptions } = useFiltersData();

    const { isLicenseValid } = useLicenseStore();

    useEffect(() => {
        for ( const key in filtersConf ) {
            if ( filtersConf.hasOwnProperty( key ) ) {
                updateTempFilters(key, getActiveFilters()[key]);
            }
        }
    },[getActiveFilters]);
    const updateTempFilters = (key, value) => {
        setTempFilters(prev => ({
            ...prev,
            [key]: value
        }));
    }

    const getOptions = async (conf) => {
        const options = conf.options || [];
        if ( conf.pro && !isLicenseValid() ) {
            return [];
        }

        if ( Array.isArray(options)) return options;
        if ( typeof options === 'string' ) {
            return await getFilterOptions(options);
        }

        return [];
    };

    const applyFilter = () => {
        Object.entries(tempFilters).forEach(([key, value]) => {
            if (value==='-1') {
                deleteFilter(key);
            } else if (value) {
                setFilters(key, value);
            } else {
                setFilters(key, '');
            }
        });

        setIsOpen(false);
    }

    const resetToDefaults = () => {
        clearAllFilters();
    }

    const footer = (
        <>
            <ButtonInput
                onClick={() => applyFilter( )}
                btnVariant="primary"
                size="sm"
                className="flex-1"
            >
                {__( 'Apply', 'burst-statistics' )}
            </ButtonInput>
            <ButtonInput
                onClick={() => resetToDefaults()}
                btnVariant="tertiary"
                size="sm"
                className="flex-1"
            >
                {__( 'Reset to defaults', 'burst-statistics' )}
            </ButtonInput>
        </>
    );

    return (
        <Popover
            showFilterIcon={false}
            isOpen={isOpen}
            setIsOpen={setIsOpen}
            title={__('Select filter', 'burst-statistics')}
            footer={footer}
            maxWidth={600}
        >
            <div className="flex flex-row flex-wrap gap-3 py-1">
                {Object.entries(filtersConf)
                    .filter(([_, conf]) => conf.type)
                    .map(([key, conf]) => {

                    if ( conf.type === 'text') {
                        return (
                            <div className="basis-1/2 max-w-[200px]" key={key}>
                                <label key={key} className="flex flex-col">{conf.label}</label>
                                <input type={'text'} value={ tempFilters[key] || ''} onChange={(e) => updateTempFilters(key, e.target.value)}/>
                            </div>
                        )
                    }
                    if ( conf.type === 'select-page') {
                        const field = {
                            id: 'pageFilter',
                            label: conf.label,
                            value: tempFilters[key] || '',
                        }
                        return (
                            <div className="basis-1/2 max-w-[200px]" key={key}>
                            <SelectPageField
                                field = {field}
                                label={ conf.label}
                                value={tempFilters[key] || ''}
                                onChange={( value ) => updateTempFilters(key, value)}
                            />
                            </div>
                        )
                    }
                    if ( conf.type === 'select') {
                        const options = getOptions(conf);
                        return (
                            <div className="basis-1/2 max-w-[200px]" key={key}>
                                <label key={key} className="flex flex-col">{conf.label}</label>
                                <select
                                    disabled={conf.pro && !isLicenseValid()}
                                    key={key}
                                    value={tempFilters[key] || -1}
                                    onChange={(e) => updateTempFilters(key, e.target.value)}
                                >
                                    <option value="-1">
                                        {__('None selected', 'burst-statistics') + ' ' }
                                        {conf.pro && !isLicenseValid() ? __('(premium)', 'burst-statistics') : ''}
                                    </option>
                                    {options.map((option) => (
                                        <option key={option.id} value={option.id}>
                                            {option.title}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        );
                    }
                })}
            </div>

        </Popover>
    );
};

export default AdvancedFilter;