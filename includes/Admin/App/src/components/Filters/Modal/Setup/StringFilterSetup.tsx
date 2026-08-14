import React, {useState, useRef, useEffect, useMemo} from 'react';
import { __ } from '@wordpress/i18n';
import AsyncSelectInput from '@/components/Inputs/AsyncSelectInput';
import TextInput from '@/components/Inputs/TextInput';
import useFiltersData from '@/hooks/useFiltersData';
import debounce from 'lodash/debounce';
import { type FilterConfig, isExcluding } from '@/config/filterConfig';
import { FilterExclusion, modifyValueBasedOnExclusionConfig } from '@/components/Filters/Modal/FilterExclusion';

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

// fallow-ignore-next-line complexity
const StringFilterSetup: React.FC<StringFilterSetupProps> = ({
	filterKey,
	config,
	initialValue = '',
	onChange
}) => {
	const value = initialValue;
	const selectInputRef = useRef<HTMLInputElement>( null );
	const textInputRef = useRef<HTMLInputElement>( null );
	const [ availableOptions, setAvailableOptions ] = useState<SelectOption[]>(
		[]
	);
	const [ filteredOptions, setFilteredOptions ] = useState<SelectOption[]>([]);
	const [ searchTerm, setSearchTerm ] = useState<string>( '' );
	const [ hasFullDataset, setHasFullDataset ] = useState<boolean>( false );
	const { getFilterOptions } = useFiltersData();

	const toSelectOptions = ( opts: unknown ): SelectOption[] => {
		return Array.isArray( opts ) ?
			opts.map( ( option: FilterOption ) => ({
				value: option.id || option.title,
				label: option.title
			}) ) :
			[];
	};

	// Clean value without '!' prefix - used for display in input/select.
	const excluded = isExcluding( value );
	const cleanValue = excluded ? value.substring( 1 ) : value;

	// Initial load - fetch first 1000 options
	useEffect( () => {
		const fetchOptions = async() => {
			if ( ! config.options ) {
				return;
			}

			const opts = await getFilterOptions( config.options, '' );
			const transformedOptions = toSelectOptions( opts );

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
			const transformedOptions = toSelectOptions( opts );

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

		// fallow-ignore-next-line complexity
		const timer = setTimeout( () => {
			if ( config.options && selectInputRef.current ) {
				selectInputRef.current.focus();
			} else if ( ! config.options && textInputRef.current ) {
				textInputRef.current.focus();
			}
		}, 100 );

		return () => clearTimeout( timer );
	}, [ config.options ]);

	// Load options function for AsyncSelectInput
	// fallow-ignore-next-line complexity
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

	const maxSelections = config.multi_select ? Number.POSITIVE_INFINITY : 1;

	const handleTextChange = ( e: React.ChangeEvent<HTMLInputElement> ) => {
		const newValue = modifyValueBasedOnExclusionConfig({ value: e.target.value, excluded });
		onChange( newValue );
	};

	const handleSelectChange = ( selected: SelectOption | SelectOption[] | null ) => {
		let rawValue = '';
		if ( Array.isArray( selected ) ) {
			rawValue = selected.map( ( opt ) => ( opt?.value ?? opt ) + '' ).filter( Boolean ).join( ',' );
		} else if ( selected ) {
			rawValue = ( selected.value ?? selected ) + '';
		}

		const newValue = modifyValueBasedOnExclusionConfig({ value: rawValue, excluded });
		onChange( newValue );
	};

	const handleExclusionChange = ( newValue: string ) => {
		onChange( newValue );
	};

	// Create option object for AsyncSelectInput current value
	const getSelectValue = (): SelectOption | SelectOption[] | null => {
		if ( ! cleanValue ) {
			return 1 < maxSelections ? [] : null;
		}

		if ( 1 < maxSelections ) {
			const rawValues = cleanValue.split( ',' ).map( ( v ) => v.trim() ).filter( Boolean );
			return rawValues.map( ( val ) => {
				const foundOption = availableOptions.find(
					( option: SelectOption ) => String( option.value ) === String( val )
				);
				return foundOption || { value: val, label: val };
			});
		}

		// Try to find the option in available options
		const foundOption = availableOptions.find(
			( option: SelectOption ) => String( option.value ) === String( cleanValue )
		);
		if ( foundOption ) {
			return foundOption;
		}

		// If not found but we have a value, create a custom option
		return {
			value: cleanValue,
			label: cleanValue
		};
	};

	// fallow-ignore-next-line complexity
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
			case 'utm_campaign':
				return __( 'Enter campaign name', 'burst-statistics' );
			case 'source':
				return __( 'Enter traffic source', 'burst-statistics' );
			case 'source_category':
				return __( 'Enter source category', 'burst-statistics' );
			case 'utm_source':
				return __( 'Enter UTM source', 'burst-statistics' );
			case 'utm_medium':
				return __( 'Enter UTM medium', 'burst-statistics' );
			case 'utm_term':
				return __( 'Enter UTM term', 'burst-statistics' );
			case 'utm_content':
				return __( 'Enter UTM content', 'burst-statistics' );
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
		<div className="flex flex-col gap-4">

			<div className="relative flex flex-col gap-2">
				<label className="block text-sm font-medium text-text-gray">
					{ __( 'Only show data where…', 'burst-statistics' ) }
				</label>
				<div className="flex items-start gap-2 pr-0.5">
					<span className="whitespace-nowrap text-sm font-medium text-text-black mt-2">
						{config.label}
					</span>

					{
						config.exclusion_allowed && (
							<FilterExclusion value={value} onChange={handleExclusionChange} />
						)
					}

					{
						config.options ? (
							<AsyncSelectInput
								ref={selectInputRef}
								value={getSelectValue()}
								onChange={handleSelectChange}
								loadOptions={loadOptions}
								defaultOptions={filteredOptions}
								placeholder={getPlaceholder()}
								isSearchable={true}
								disabled={false}
								allowCustomValue={0 === filteredOptions.length}
								maxSelections={maxSelections}
								initialIsOpen={true}
								selectionSeparator={
									config.multi_select ?
										__( 'or', 'burst-statistics' ) :
										undefined
								}
							/>
					) : (
						<TextInput
							ref={textInputRef}
							value={cleanValue}
							onChange={handleTextChange}
							placeholder={getPlaceholder()}
							className="w-full"
						/>
					)
					}
				</div>
			</div>
		</div>
	);
};

export default StringFilterSetup;
