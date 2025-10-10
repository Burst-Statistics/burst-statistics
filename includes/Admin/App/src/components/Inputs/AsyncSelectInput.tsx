import React, { useState, useEffect, forwardRef, useRef, useCallback } from 'react';
import { useCombobox, useMultipleSelection } from 'downshift';
import { debounce } from 'lodash';

interface SelectOption {
    value: any;
    label: string;
    isCustom?: boolean;
    [key: string]: any;
}

interface AsyncSelectInputProps {
    /** The current value - can be primitive value, option object, or array for multiple selections */
    value?: any;
    /** Callback when the value changes - receives single item or array based on maxSelections */
    onChange: (value: any) => void;
    /** Function to load options asynchronously */
    loadOptions?: (inputValue: string, callback: (options: SelectOption[]) => void) => void;
    /** Default options to show */
    defaultOptions?: SelectOption[] | boolean;
    /** Whether the select is loading */
    isLoading?: boolean;
    /** Whether the select is searchable */
    isSearchable?: boolean;
    /** Name for the select */
    name?: string;
    /** If true, the field is disabled */
    disabled?: boolean;
    /** Placeholder text */
    placeholder?: string;
    /** If true, positions dropdown with fixed positioning (useful inside modals) */
    insideModal?: boolean;
    /** Maximum number of selections allowed (default: 1) */
    maxSelections?: number;
    /** Whether to show remove buttons on selected items */
    showRemoveButton?: boolean;
    /** Whether to allow creating custom options when no matches are found */
    allowCustomValue?: boolean;
}

/**
 * AsyncSelect input component using Downshift with multiple selection support.
 * 
 * A combobox component that supports async loading of options and multiple selections.
 * Uses Downshift's useCombobox and useMultipleSelection hooks for accessibility and keyboard navigation.
 */
const AsyncSelectInput = forwardRef<HTMLInputElement, AsyncSelectInputProps>(
    ({
        value,
        onChange,
        loadOptions,
        defaultOptions = [],
        isLoading = false,
        isSearchable = true,
        name,
        disabled = false,
        placeholder = 'Select an option...',
        insideModal = false,
        maxSelections = 1,
        showRemoveButton = true,
        allowCustomValue = true,
        ...props
    }, ref) => {
        const [items, setItems] = useState<SelectOption[]>([]);
        // Initialize input value - should be empty if there are already selected items
        const [inputValue, setInputValue] = useState('');
        const [loading, setLoading] = useState(isLoading);

        // Create debounced search function
        const debouncedLoadOptions = useCallback(
            debounce((searchValue: string) => {
                if (loadOptions) {
                    setLoading(true);
                    loadOptions(searchValue, (options) => {
                        setItems(options);
                        setLoading(false);
                    });
                }
            }, 150),
            [loadOptions]
        );

        // Cleanup debounce on unmount
        useEffect(() => {
            return () => {
                debouncedLoadOptions.cancel();
            };
        }, [debouncedLoadOptions]);

        // Initialize items with default options
        useEffect(() => {
            if (Array.isArray(defaultOptions)) {
                setItems(defaultOptions);
            } else if (defaultOptions === true && loadOptions) {
                // Load initial options
                setLoading(true);
                loadOptions('', (options) => {
                    setItems(options);
                    setLoading(false);
                });
            }
        }, [defaultOptions, loadOptions]);

        // Convert value to array of selected items
        const getSelectedItems = (): SelectOption[] => {
            if (!value) return [];
            
            // Handle array values (multiple selections)
            if (Array.isArray(value)) {
                return value.map(item => {
                    if (typeof item === 'object' && item.hasOwnProperty('value') && item.hasOwnProperty('label')) {
                        return item;
                    }
                    // Find in items or create basic option
                    const foundOption = items.find(option => option.value === item);
                    return foundOption || { value: item, label: item.toString() };
                });
            }
            
            // Handle single value
            if (typeof value === 'object' && value.hasOwnProperty('value') && value.hasOwnProperty('label')) {
                return [value];
            }
            
            // If value is primitive, try to find it in items
            const foundOption = items.find(option => option.value === value);
            if (foundOption) return [foundOption];
            
            // Create basic option object
            return [{
                value: value,
                label: value.toString()
            }];
        };

        // Use propSelectedItems if provided, otherwise use the state
        const currentSelectedItems = getSelectedItems();
        // Filter items to exclude already selected ones
        let availableItems = items.filter(item => 
            !currentSelectedItems.some(selected => selected.value === item.value)
        );

        // Add custom option if allowed and input doesn't match any existing option
        const canAddCustom =
            allowCustomValue &&
            inputValue.trim() !== '' &&
            (
                items.length === 0 ||
                (
                    !items.some(item => (item.label ?? '').toLowerCase() === inputValue.toLowerCase()) &&
                    !currentSelectedItems.some(selected => (selected.label ?? '').toLowerCase() === inputValue.toLowerCase())
                )
            );


        if (canAddCustom) {
            availableItems = [
                {
                    value: inputValue.trim(),
                    label: inputValue.trim(),
                    isCustom: true
                },
                ...availableItems
            ];
        }

        const {
            getSelectedItemProps,
            getDropdownProps,
            addSelectedItem,
            removeSelectedItem,
        } = useMultipleSelection({
            selectedItems: currentSelectedItems, // Use currentSelectedItems from props or state
            onStateChange({ selectedItems: newSelectedItems, type }) {
                switch (type) {
                    case useMultipleSelection.stateChangeTypes.SelectedItemKeyDownBackspace:
                    case useMultipleSelection.stateChangeTypes.SelectedItemKeyDownDelete:
                    case useMultipleSelection.stateChangeTypes.DropdownKeyDownBackspace:
                    case useMultipleSelection.stateChangeTypes.FunctionRemoveSelectedItem:
                        // Return single item or array based on maxSelections
                        if (newSelectedItems) {
                            if (maxSelections === 1) {
                                onChange(newSelectedItems.length > 0 ? newSelectedItems[0] : null);
                            } else {
                                onChange(newSelectedItems);
                            }
                        }
                        break;
                    default:
                        break;
                }
            },
        });

        const {
            isOpen,
            getToggleButtonProps,
            getInputProps,
            getMenuProps,
            getItemProps,
            highlightedIndex,
            getComboboxProps
        } = useCombobox({
            items: availableItems,
            selectedItem: null,
            inputValue,
            stateReducer(state, actionAndChanges) {
                const { changes, type } = actionAndChanges;
                switch (type) {
                    case useCombobox.stateChangeTypes.InputKeyDownEnter:
                    case useCombobox.stateChangeTypes.ItemClick:
                        return {
                            ...changes,
                            isOpen: maxSelections > 1 ? true : false, // Keep open for multiple, close for single
                            highlightedIndex: 0,
                            inputValue: '', // Clear input after selection
                        };
                    default:
                        return changes;
                }
            },
            onStateChange({ type, selectedItem: newSelectedItem, inputValue: newInputValue }) {
                switch (type) {
                    case useCombobox.stateChangeTypes.InputKeyDownEnter:
                    case useCombobox.stateChangeTypes.ItemClick:
                        if (newSelectedItem) {
                            // For single selection, automatically replace existing selection
                            if (maxSelections === 1) {
                                onChange(newSelectedItem);
                                setInputValue('');
                            }
                            // For multiple selections, only add if under limit
                            else if (currentSelectedItems.length < maxSelections) {
                                const newSelectedItems = [...currentSelectedItems, newSelectedItem];
                                onChange(newSelectedItems);
                                setInputValue('');
                            }
                        }
                        break;
                    case useCombobox.stateChangeTypes.InputChange:
                        setInputValue(newInputValue || '');
                        
                        if (loadOptions && isSearchable) {
                            debouncedLoadOptions(newInputValue || '');
                        }
                        break;
                    default:
                        break;
                }
            },
            itemToString: (item) => item ? item.label : '',
        });

        const handleRemoveItem = (itemToRemove: SelectOption) => {
            const newSelectedItems = currentSelectedItems.filter(item => item.value !== itemToRemove.value);
            
            // Return single item or array based on maxSelections
            if (maxSelections === 1) {
                onChange(newSelectedItems.length > 0 ? newSelectedItems[0] : null);
            } else {
                onChange(newSelectedItems);
            }
        };

        // Handle backspace when input is empty to remove last selected item
        const handleKeyDown = (event: React.KeyboardEvent) => {
            if (event.key === 'Backspace' && inputValue === '' && currentSelectedItems.length > 0) {
                event.preventDefault();
                const lastItem = currentSelectedItems[currentSelectedItems.length - 1];
                handleRemoveItem(lastItem);
            }
        };

        return (
            <>
                {/* Combobox container with integrated selected items */}
                <div {...getComboboxProps()} className="flex min-h-[2.5rem] w-full rounded-md border border-gray-400 bg-white focus-within:border-primary-dark focus-within:ring disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-200">
                    {/* Container for selected items and input */}
                    <div className="flex flex-1 flex-wrap items-center gap-1 p-1">
                        {/* Selected items (tags) */}
                        {currentSelectedItems.map((selectedItem, index) => (
                            <span
                                key={`selected-item-${index}`}
                                {...getSelectedItemProps({
                                    selectedItem,
                                    index,
                                })}
                                className="inline-flex items-center gap-1 rounded bg-primary-light px-2 py-1 text-xs text-primary-dark focus:bg-primary focus:text-white focus:outline-none"
                            >
                                {selectedItem.label}
                                {showRemoveButton && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveItem(selectedItem);
                                        }}
                                        className="ml-1 rounded-full hover:bg-primary hover:text-white focus:bg-primary focus:text-white focus:outline-none"
                                        aria-label={`Remove ${selectedItem.label}`}
                                    >
                                        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                )}
                            </span>
                        ))}
                        
                        {/* Input field */}
                        {(maxSelections === 1 || currentSelectedItems.length < maxSelections) && (
                            <input
                                {...getInputProps(getDropdownProps({
                                    preventKeyAction: isOpen,
                                    ...(ref ? { ref } : {}),
                                    name,
                                    disabled,
                                    placeholder: currentSelectedItems.length === 0 ? placeholder :
                                        maxSelections > 1 ? `Add ${maxSelections - currentSelectedItems.length} more...` : '',
                                    readOnly: !isSearchable,
                                    onKeyDown: handleKeyDown,
                                    ...props
                                }))}
                                className="flex-1 min-w-[120px] border-none bg-transparent p-1 focus:outline-none disabled:cursor-not-allowed"
                                style={{ outline: 'none' }}
                            />
                        )}
                    </div>
                    
                    {/* Selection counter and toggle button */}
                    <div className="flex items-center border-l border-gray-300">
                        {/* Max selections indicator */}
                        {maxSelections > 0 && (
                            <span className="px-2 text-xs text-gray-500 border-r border-gray-200">
                                {currentSelectedItems.length}/{maxSelections}
                            </span>
                        )}
                        
                        {/* Toggle button */}
                        <button
                            type="button"
                            {...getToggleButtonProps({
                                disabled,
                            })}
                            className="flex items-center justify-center bg-transparent px-2 py-2 hover:bg-gray-100 focus:border-primary-dark focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-200"
                            aria-label="Toggle menu"
                        >
                            {loading ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-primary"></div>
                            ) : (
                                <svg
                                    className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>

                {/* Menu */}
                <div {...getMenuProps()} className={`w-full ${insideModal ? "fixed" : ""} ${!isOpen ? "hidden" : ""}`}>
                    <ul
                        className={`relative top-0 z-[9999] max-h-60 overflow-y-auto w-full rounded-md border border-gray-300 bg-white shadow-lg ${
                            !(isOpen && availableItems.length) ? 'hidden' : ''
                        }`}
                    >
                        {availableItems.map((item, index) => (
                            <li
                                key={item.value}
                                {...getItemProps({ item, index })}
                                className={`cursor-pointer px-3 py-2 text-sm first:rounded-t-md last:rounded-b-md ${
                                    highlightedIndex === index
                                        ? 'bg-primary-light text-primary-dark'
                                        : 'hover:bg-gray-100'
                                }`}
                            >
                                {item.isCustom ? (
                                    <span className="flex items-center gap-2">
                                        <svg className="h-4 w-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                        </svg>
                                        Create "{item.label}"
                                    </span>
                                ) : (
                                    item.label
                                )}
                            </li>
                        ))}
                        {availableItems.length === 0 && !loading && (
                            <li className="px-3 py-2 text-sm text-gray-500">
                                {currentSelectedItems.length >= maxSelections 
                                    ? `Maximum ${maxSelections} selection${maxSelections > 1 ? 's' : ''} reached`
                                    : 'No options found'
                                }
                            </li>
                        )}
                    </ul>
                </div>
            </>
        );
    },
);

AsyncSelectInput.displayName = 'AsyncSelectInput';

export default AsyncSelectInput; 