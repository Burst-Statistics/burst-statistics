import React, {useState, useRef, useEffect, useCallback} from 'react';
import { __ } from '@wordpress/i18n';
import AsyncSelectInput from '@/components/Inputs/AsyncSelectInput';
import TextInput from '@/components/Inputs/TextInput';
import useFiltersData from '@/hooks/useFiltersData';
import debounce from "lodash/debounce";

interface FilterConfig {
    label: string;
    icon: string;
    type: string;
    options?: string;
    pro?: boolean;
    reloadOnSearch?: boolean;
}

interface FilterOption {
    id: string;
    title: string;
}

interface SelectOption {
    value: string;
    label: string;
}

interface StringFilterSetupProps {
    filterKey: string;
    config: FilterConfig;
    initialValue?: string;
    onChange: (value: string) => void;
}

const StringFilterSetup: React.FC<StringFilterSetupProps> = ({
                                                                 filterKey,
                                                                 config,
                                                                 initialValue = '',
                                                                 onChange
                                                             }) => {
    const [value, setValue] = useState<string>(initialValue);
    const selectInputRef = useRef<any>(null);
    const textInputRef = useRef<HTMLInputElement>(null);
    const [availableOptions, setAvailableOptions] = useState<SelectOption[]>([]);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [hasFullDataset, setHasFullDataset] = useState<boolean>(false);
    const { getFilterOptions, isLoading, isError } = useFiltersData();

    useEffect(() => {
        setValue(initialValue);
    }, [initialValue]);

    // Initial load - fetch first 1000 options
    useEffect(() => {
        const fetchOptions = async () => {
            if (!config.options) return;

            const opts = await getFilterOptions(config.options, '');
            const transformedOptions: SelectOption[] = Array.isArray(opts) ? opts.map((option: FilterOption) => ({
                value: option.id || option.title,
                label: option.title
            })) : [];

            setAvailableOptions(transformedOptions);
            // If we got less than 1000 options, we have the full dataset
            setHasFullDataset(transformedOptions.length < 1000);
        }
        fetchOptions();
    }, [config.options, getFilterOptions]);

    // Debounced fetch function
    const debouncedFetchOptions = useCallback(
        debounce(async (search: string) => {
            if (!config.options) return;

            const opts = await getFilterOptions(config.options, search);
            const transformedOptions: SelectOption[] = Array.isArray(opts) ? opts.map((option: FilterOption) => ({
                value: option.id || option.title,
                label: option.title
            })) : [];

            setAvailableOptions(transformedOptions);
        }, 300),
        [config.options, getFilterOptions]
    );

    // Reload options when search term changes (if reloadOnSearch is enabled)
    useEffect(() => {
        // Skip if reloadOnSearch is disabled
        if (!config.reloadOnSearch || !config.options) return;
        // Skip if search term is too short
        if (searchTerm.length < 3) return;
        // Skip if we already have the full dataset (< 1000 items)
        if (hasFullDataset) return;

        debouncedFetchOptions(searchTerm);

        // Cleanup: cancel debounced function on unmount
        return () => {
            debouncedFetchOptions.cancel();
        };
    }, [searchTerm, config.reloadOnSearch, hasFullDataset, debouncedFetchOptions]);

    // Focus the appropriate input on mount
    useEffect(() => {
        const timer = setTimeout(() => {
            if (config.options && selectInputRef.current) {
                if (selectInputRef.current.focus) {
                    selectInputRef.current.focus();
                } else if (selectInputRef.current.select?.inputRef?.current) {
                    selectInputRef.current.select.inputRef.current.focus();
                }
            } else if (!config.options && textInputRef.current) {
                textInputRef.current.focus();
            }
        }, 100);

        return () => clearTimeout(timer);
    }, [config.options]);

    // Load options function for AsyncSelectInput
    const loadOptions = (inputValue: string, callback: (options: SelectOption[]) => void) => {
        // Update search term for reloadOnSearch functionality
        setSearchTerm(inputValue);

        // If still loading, return empty array
        if (isLoading) {
            callback([]);
            return;
        }

        // If error, return empty array
        if (isError) {
            callback([]);
            return;
        }

        if (!availableOptions.length) {
            callback([]);
            return;
        }

        // If reloadOnSearch is enabled, we have the full dataset, or search < 3 chars
        // do client-side filtering
        if (hasFullDataset || !config.reloadOnSearch || inputValue.length < 3) {
            const filteredOptions = availableOptions.filter(function (option) {
                const label = (option.label ?? '').toLowerCase();
                const value = (option.value ?? '').toLowerCase();
                const input = inputValue.toLowerCase();

                return label.includes(input) || value.includes(input);
            });
            callback(filteredOptions);
            return;
        }

        // For server-side filtering (reloadOnSearch enabled, 3+ chars, large dataset)
        // the options are already being fetched via useEffect
        callback(availableOptions);
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setValue(newValue);
        onChange(newValue);
    };

    const handleSelectChange = (selectedOption: any) => {
        const newValue = selectedOption ? selectedOption.value : '';
        setValue(newValue);
        onChange(newValue);
    };

    // Create option object for AsyncSelectInput current value
    const getSelectValue = (): SelectOption | null => {
        if (!value) return null;

        // Try to find the option in available options
        const foundOption = availableOptions.find((option: SelectOption) => option.value === value);
        if (foundOption) return foundOption;

        // If not found but we have a value, create a custom option
        return {
            value: value,
            label: value
        };
    };

    const getPlaceholder = (): string => {
        if (config.options) {
            return __('Search or select an option...', 'burst-statistics');
        }

        // Custom placeholders based on filter type
        switch (filterKey) {
            case 'page_url':
                return __('Enter page URL (e.g., /about)', 'burst-statistics');
            case 'referrer':
                return __('Enter referrer URL (e.g., google.com)', 'burst-statistics');
            case 'campaign':
                return __('Enter campaign name', 'burst-statistics');
            case 'source':
                return __('Enter traffic source', 'burst-statistics');
            case 'medium':
                return __('Enter traffic medium', 'burst-statistics');
            case 'term':
                return __('Enter search term', 'burst-statistics');
            case 'content':
                return __('Enter content identifier', 'burst-statistics');
            case 'url_parameter':
                return __('Enter URL parameter (e.g., utm_campaign)', 'burst-statistics');
            default:
                return __('Enter filter value...', 'burst-statistics');
        }
    };

    return (
        <div className="space-y-4">
            {/* Input Field */}
            <div className="space-y-2 relative">
                <label className="block text-sm font-medium text-gray-700">
                    {__('Filter value', 'burst-statistics')}
                </label>

                {/* Always render the same input type based on config.options */}
                {config.options ? (
                    <AsyncSelectInput
                        ref={selectInputRef}
                        value={getSelectValue()}
                        onChange={handleSelectChange}
                        loadOptions={loadOptions}
                        defaultOptions={availableOptions}
                        placeholder={getPlaceholder()}
                        isSearchable={true}
                        isLoading={isLoading}
                        disabled={false}
                        insideModal={true}
                    />
                ) : (
                    <TextInput
                        ref={textInputRef}
                        value={value}
                        onChange={handleTextChange}
                        placeholder={getPlaceholder()}
                        className="w-full"
                    />
                )}
            </div>
        </div>
    );
};

export default StringFilterSetup;