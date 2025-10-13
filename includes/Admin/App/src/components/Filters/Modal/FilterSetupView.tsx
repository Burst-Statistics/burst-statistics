import React from 'react';
import { __ } from '@wordpress/i18n';
import StringFilterSetup from './Setup/StringFilterSetup';
import BooleanFilterSetup from './Setup/BooleanFilterSetup';
import IntFilterSetup from './Setup/IntFilterSetup';
import DeviceFilterSetup from './Setup/DeviceFilterSetup';
import Icon from '@/utils/Icon';

interface FilterConfig {
    label: string;
    icon: string;
    type: string;
    options?: string;
    pro?: boolean;
}

interface FilterSetupViewProps {
    filterKey: string;
    config: FilterConfig;
    onBack: () => void;
    tempValue: string;
    onTempValueChange: (value: string) => void;
}

const FilterSetupView: React.FC<FilterSetupViewProps> = ({ 
    filterKey, 
    config, 
    onBack,
    tempValue,
    onTempValueChange
}) => {
    const renderSetupComponent = (): React.ReactNode => {
        const commonProps = {
            filterKey,
            config,
            initialValue: tempValue,
            onChange: onTempValueChange
        };

        // Special case for device filter - use custom UI
        if (filterKey === 'device_id') {
            return <DeviceFilterSetup {...commonProps} />;
        }

        switch (config.type) {
            case 'string':
                return <StringFilterSetup {...commonProps} />;
            case 'boolean':
                return <BooleanFilterSetup {...commonProps} />;
            case 'int':
                return <IntFilterSetup {...commonProps} />;
            default:
                return <StringFilterSetup {...commonProps} />;
        }
    };

    return (
        <div className="h-full">
            {renderSetupComponent()}
        </div>
    );
};

export default FilterSetupView; 