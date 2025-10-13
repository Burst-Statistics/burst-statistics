import React, { useState } from 'react';
import { __ } from '@wordpress/i18n';
import Modal from '@/components/Common/Modal';
import FilterSelectionView from './FilterSelectionView';
import FilterSetupView from './FilterSetupView';
import { useFiltersStore } from '@/store/useFiltersStore';
import ButtonInput from '@/components/Inputs/ButtonInput';
import Icon from '@/utils/Icon';

interface FilterConfig {
    label: string;
    icon: string;
    type: string;
    pro?: boolean;
    options?: string;
}

interface FilterModalProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    initialFilter?: {
        key: string;
        config: FilterConfig;
        value: string;
    };
}

type ModalStep = 'selection' | 'setup';

const FilterModal: React.FC<FilterModalProps> = ({ isOpen, setIsOpen, initialFilter }) => {
    const setFilters = useFiltersStore(state => state.setFilters);
    const deleteFilter = useFiltersStore(state => state.deleteFilter);
    const clearAllFilters = useFiltersStore(state => state.clearAllFilters);
    const getActiveFilters = useFiltersStore(state => state.getActiveFilters);
    
    const [currentStep, setCurrentStep] = useState<ModalStep>('selection');
    const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
    const [selectedConfig, setSelectedConfig] = useState<FilterConfig | null>(null);
    const [tempValue, setTempValue] = useState<string>('');

    // Reset modal state when modal is closed/opened
    React.useEffect(() => {
        if (isOpen) {
            if (initialFilter) {
                // If editing an existing filter, go directly to setup
                setCurrentStep('setup');
                setSelectedFilter(initialFilter.key);
                setSelectedConfig(initialFilter.config);
                setTempValue(initialFilter.value);
            } else {
                // If adding a new filter, start with selection
                setCurrentStep('selection');
                setSelectedFilter(null);
                setSelectedConfig(null);
                setTempValue('');
            }
        }
    }, [isOpen, initialFilter]);

    const handleSelectFilter = (filterKey: string, config: FilterConfig) => {
        setSelectedFilter(filterKey);
        setSelectedConfig(config);
        setCurrentStep('setup');
        
        // Set initial temp value from existing filter
        const activeFilters = getActiveFilters();
        setTempValue(activeFilters[filterKey] || '');
    };

    const handleBack = () => {
        setCurrentStep('selection');
        setSelectedFilter(null);
        setSelectedConfig(null);
        setTempValue('');
    };

    const handleApply = (filterKey: string, value: string) => {
        if (value === '' || value === null || value === undefined) {
            deleteFilter(filterKey);
        } else {
            setFilters(filterKey, value);
        }
        setIsOpen(false);
    };

    const handleApplyAndAddMore = (filterKey: string, value: string) => {
        if (value === '' || value === null || value === undefined) {
            deleteFilter(filterKey);
        } else {
            setFilters(filterKey, value);
        }
        handleBack();
    };

    const handleTempValueChange = (value: string) => {
        setTempValue(value);
    };

    const handleApplyClick = () => {
        if (selectedFilter) {
            handleApply(selectedFilter, tempValue);
        }
    };

    const handleApplyAndAddMoreClick = () => {
        if (selectedFilter) {
            handleApplyAndAddMore(selectedFilter, tempValue);
        }
    };

    const handleResetToDefaults = () => {
        clearAllFilters();
        setIsOpen(false);
    };

    const renderContent = (): React.ReactNode => {
        if (currentStep === 'selection') {
            return (
                <FilterSelectionView
                    onSelectFilter={handleSelectFilter}
                />
            );
        } else {
            return (
                <FilterSetupView
                    filterKey={selectedFilter!}
                    config={selectedConfig!}
                    onBack={handleBack}
                    tempValue={tempValue}
                    onTempValueChange={handleTempValueChange}
                />
            );
        }
    };

    const renderFooter = (): React.ReactNode | null => {
        if (currentStep === 'selection') {
            return (
                <ButtonInput
                    onClick={handleResetToDefaults}
                    btnVariant="tertiary"
                    size="sm"
                    className="w-full"
                    ariaLabel={__('Reset all active filters to default settings', 'burst-statistics')}
                >
                    {__('Reset all filters', 'burst-statistics')}
                </ButtonInput>
            );
        } else if (currentStep === 'setup') {
            return (
                <div className="flex space-x-3">
                    <ButtonInput
                        onClick={handleApplyClick}
                        btnVariant="primary"
                        size="sm"
                        className="flex-1"
                        ariaLabel={selectedConfig ? __('Apply %s filter', 'burst-statistics').replace('%s', selectedConfig.label) : __('Apply filter', 'burst-statistics')}
                    >
                        {__('Apply Filter', 'burst-statistics')}
                    </ButtonInput>
                    <ButtonInput
                        onClick={handleApplyAndAddMoreClick}
                        btnVariant="secondary"
                        size="sm"
                        className="flex-1"
                        ariaLabel={selectedConfig ? __('Apply %s filter and continue adding more filters', 'burst-statistics').replace('%s', selectedConfig.label) : __('Apply filter and add more', 'burst-statistics')}
                    >
                        {__('Apply & Add More', 'burst-statistics')}
                    </ButtonInput>
                </div>
            );
        }
        return null;
    };

    const getTitle = (): string => {
        if (currentStep === 'selection') {
            return __('Select a filter', 'burst-statistics');
        } else {
            return __('Setup Filter', 'burst-statistics');
        }
    };

    const getSubtitle = (): string => {
        if (currentStep === 'selection') {
            return __('Choose a filter to apply to your analytics data', 'burst-statistics');
        } else {
            return __('Setup filter', 'burst-statistics');
        }
    };

    const getFilterDescription = (): string => {
        if (currentStep !== 'setup' || !selectedConfig) return '';
        
        // Different descriptions based on filter type
        if (selectedConfig.type === 'string') {
            return selectedConfig.options 
                ? __('Start typing to search or select from available options', 'burst-statistics')
                : __('Enter the value you want to filter by', 'burst-statistics');
        } else if (selectedConfig.type === 'int') {
            return __('Set the range for this filter', 'burst-statistics');
        } else if (selectedConfig.type === 'boolean') {
            return __('Select the option you want to filter by', 'burst-statistics');
        }
        return '';
    };

    // Custom header for setup step  
    const renderCustomHeader = (): React.ReactNode => {
        if (currentStep !== 'setup' || !selectedConfig) return null;

        return (
            <div>
                {/* Back Button */}
                <div className="flex items-center space-x-3 mb-4">
                    <button
                        onClick={handleBack}
                        className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded transition-all duration-200"
                        aria-label={__('Back to filters', 'burst-statistics')}
                        type="button"
                    >
                        <Icon name="chevron-left" size={16} aria-hidden="true" />
                        <span>{__('Back to filters', 'burst-statistics')}</span>
                    </button>
                </div>

                {/* Filter Header */}
                <div className="flex items-center space-x-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-light">
                        <Icon 
                            name={selectedConfig.icon} 
                            color="gray" 
                            size={20} 
                        />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                            {selectedConfig.label}
                        </h3>
                        <p className="text-sm text-gray-600">
                            {getFilterDescription()}
                        </p>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            title={currentStep === 'selection' ? getTitle() : undefined}
            subtitle={currentStep === 'selection' ? getSubtitle() : undefined}
            customHeader={currentStep === 'setup' ? renderCustomHeader() : null}
            content={renderContent()}
            footer={renderFooter()}
            triggerClassName=""
            children={null}
        />
    );
};

export default FilterModal; 