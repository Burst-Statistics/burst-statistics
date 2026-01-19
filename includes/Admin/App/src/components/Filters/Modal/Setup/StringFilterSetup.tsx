import React, {useState, useRef, useEffect, useMemo} from 'react';
import { __ } from '@wordpress/i18n';
import AsyncSelectInput from '@/components/Inputs/AsyncSelectInput';
import TextInput from '@/components/Inputs/TextInput';
import useFiltersData from '@/hooks/useFiltersData';
import debounce from 'lodash/debounce';

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
	onChange: ( value: string ) => void;
}

const StringFilterSetup: React.FC<StringFilterSetupProps> = ({
	filterKey,
	config,
	initialValue = '',
	onChange
}) => {
	const [ value, setValue ] = useState<string>( initialValue );
	const selectInputRef = useRef<any>( null ); // eslint-disable-line @typescript-eslint/no-explicit-any
	const textInputRef = useRef<HTMLInputElement>( null );
	const [ availableOptions, setAvailableOptions ] = useState<SelectOption[]>(
		[]
	);
	const [ filteredOptions, setFilteredOptions ] = useState<SelectOption[]>([]);
	const [ searchTerm, setSearchTerm ] = useState<string>( '' );
	const [ hasFullDataset, setHasFullDataset ] = useState<boolean>( false );
	const { getFilterOptions } = useFiltersData();

	useEffect( () => {
		setValue( initialValue );
	}, [ initialValue ]);

	// Initial load - fetch first 1000 options
	useEffect( () => {
		const fetchOptions = async() => {
			if ( ! config.options ) {
				return;
			}

			const opts = await getFilterOptions( config.options, '' );
			const transformedOptions: SelectOption[] = Array.isArray( opts ) ?
				opts.map( ( option: FilterOption ) => ({
						value: option.id || option.title,
						label: option.title
					}) ) :
				[];

			setAvailableOptions( transformedOptions );

			// ensure dropdown shows all options by default
			setFilteredOptions( transformedOptions );

			// If we got less than 1000 options, we have the full dataset
			setHasFullDataset( 1000 > transformedOptions.length );
		};
		fetchOptions();
	}, [ config.options, getFilterOptions ]);

	// Debounced fetch function
	const debouncedFetchOptions = useMemo( () => {
		return debounce( async( search: string ) => {
			if ( ! config.options ) {
				return;
			}

			const opts = await getFilterOptions( config.options, search );

			const transformedOptions: SelectOption[] = Array.isArray( opts ) ?
				opts.map( ( option: FilterOption ) => ({
					value: option.id || option.title,
					label: option.title
				}) ) :
				[];

			setAvailableOptions( transformedOptions );

			if ( ! search ) {
				setFilteredOptions( transformedOptions );
			}
		}, 300 );
	}, [ config.options, getFilterOptions ]); // eslint-disable-line react-hooks/exhaustive-deps

	// Reload options when search term changes (if reloadOnSearch is enabled)
	useEffect( () => {

		// Skip if reloadOnSearch is disabled
		if ( ! config.reloadOnSearch || ! config.options ) {
			return;
		}

		// Skip if search term is too short
		if ( 3 > searchTerm.length ) {
			return;
		}

		// Skip if we already have the full dataset (< 1000 items)
		if ( hasFullDataset ) {
			return;
		}

		debouncedFetchOptions( searchTerm );

		// Cleanup: cancel debounced function on unmount
		return () => {
			debouncedFetchOptions.cancel();
		};
	}, [ // eslint-disable-line react-hooks/exhaustive-deps
		searchTerm,
		config.reloadOnSearch,
		hasFullDataset,
		debouncedFetchOptions
	]);

	// Focus the appropriate input on mount
	useEffect( () => {
		const timer = setTimeout( () => {
			if ( config.options && selectInputRef.current ) {
				if ( selectInputRef.current.focus ) {
					selectInputRef.current.focus();
				} else if ( selectInputRef.current.select?.inputRef?.current ) {
					selectInputRef.current.select.inputRef.current.focus();
				}
			} else if ( ! config.options && textInputRef.current ) {
				textInputRef.current.focus();
			}
		}, 100 );

		return () => clearTimeout( timer );
	}, [ config.options ]);

	// Load options function for AsyncSelectInput
	const loadOptions = async(
		inputValue?: string,
		callback?: ( options: SelectOption[]) => void
	) => {
		const input = String( inputValue ?? '' ).toLowerCase();

		// Update search term for reloadOnSearch functionality
		setSearchTerm( input );

		// If no available options yet, return empty array
		if ( ! availableOptions.length ) {
			callback?.([]);
			return;
		}

		// If input is empty, return all available options
		if ( 0 === input.length ) {
			callback?.( availableOptions );
			setFilteredOptions( availableOptions );
			return;
		}

		// Always do client-side filtering on the available options
		const filtered = availableOptions.filter( function( option ) {
			const label = String( option.label ?? '' ).toLowerCase();
			const value = String( option.value ?? '' ).toLowerCase();
			return label.includes( input ) || value.includes( input );
		});

		callback?.( filtered );
		setFilteredOptions( filtered );
	};

	const handleTextChange = ( e: React.ChangeEvent<HTMLInputElement> ) => {
		const newValue = e.target.value;
		setValue( newValue );
		onChange( newValue );
	};

	const handleSelectChange = ( selectedOption: any ) => {  // eslint-disable-line @typescript-eslint/no-explicit-any
		const newValue = selectedOption ? selectedOption.value : '';
		setValue( newValue );
		onChange( newValue );
	};

	// Create option object for AsyncSelectInput current value
	const getSelectValue = (): SelectOption | null => {
		if ( ! value ) {
			return null;
		}

		// Try to find the option in available options
		const foundOption = availableOptions.find(
			( option: SelectOption ) => option.value === value
		);
		if ( foundOption ) {
			return foundOption;
		}

		// If not found but we have a value, create a custom option
		return {
			value,
			label: value
		};
	};

	const getPlaceholder = (): string => {
		if ( config.options ) {
			return __( 'Search or select an option…', 'burst-statistics' );
		}

		switch ( filterKey ) {
			case 'page_url':
				return __( 'Enter page URL (e.g., /about)', 'burst-statistics' );
			case 'referrer':
				return __(
					'Enter referrer URL (e.g., google.com)',
					'burst-statistics'
				);
			case 'campaign':
				return __( 'Enter campaign name', 'burst-statistics' );
			case 'source':
				return __( 'Enter traffic source', 'burst-statistics' );
			case 'medium':
				return __( 'Enter traffic medium', 'burst-statistics' );
			case 'term':
				return __( 'Enter search term', 'burst-statistics' );
			case 'content':
				return __( 'Enter content identifier', 'burst-statistics' );
			case 'parameter':
				return __(
					'Enter URL parameter (e.g., utm_campaign)',
					'burst-statistics'
				);
			default:
				return __( 'Enter filter value…', 'burst-statistics' );
		}
	};

	return (
		<div className="space-y-4">
			{/* Input Field */}
			<div className="space-y-2 relative">
				<label className="block text-sm font-medium text-gray-700">
					{__( 'Filter value', 'burst-statistics' )}
				</label>

				{config.options ? (
					<AsyncSelectInput
						ref={selectInputRef}
						value={getSelectValue()}
						onChange={handleSelectChange}
						loadOptions={loadOptions}
						defaultOptions={filteredOptions}
						placeholder={getPlaceholder()}
						isSearchable={true}
						disabled={false}
						insideModal={true}
						allowCustomValue={0 === filteredOptions.length}
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
