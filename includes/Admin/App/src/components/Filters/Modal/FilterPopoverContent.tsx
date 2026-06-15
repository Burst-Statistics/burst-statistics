import React, { useState } from 'react';
import { __ } from '@wordpress/i18n';
import FilterSelectionView from './FilterSelectionView';
import FilterSetupView from './FilterSetupView';
import { useFilters } from '@/hooks/useFilters';
import ButtonInput from '@/components/Inputs/ButtonInput';
import Icon from '@/utils/Icon';
import { type FilterConfig } from '@/config/filterConfig';

interface FilterPopoverContentProps {
	isOpen: boolean;
	onClose: () => void;
	initialFilter?: {
		key: string;
		config: FilterConfig;
		value: string;
	} | null;
	reportBlockIndex: number;
}

type PopoverStep = 'selection' | 'setup';

/**
 * FilterPopoverContent renders the two-step filter flow (selection → setup)
 * as a self-contained panel suitable for use inside a Radix Popover.Content.
 *
 * @param {FilterPopoverContentProps} props - Component props.
 * @return {JSX.Element} The rendered filter popover panel.
 */
const FilterPopoverContent: React.FC<FilterPopoverContentProps> = ({
	isOpen,
	onClose,
	initialFilter,
	reportBlockIndex
}) => {
	const { setFilters, deleteFilter, clearAllFilters, getActiveFilters } =
		useFilters( reportBlockIndex );

	const [ currentStep, setCurrentStep ] = useState<PopoverStep>( 'selection' );
	const [ selectedFilter, setSelectedFilter ] = useState<string | null>( null );
	const [ selectedConfig, setSelectedConfig ] =
		useState<FilterConfig | null>( null );
	const [ tempValue, setTempValue ] = useState<string>( '' );

	// Sync state when popover opens or initialFilter changes.
	React.useEffect( () => {
		if ( isOpen ) {
			if ( initialFilter ) {
				setCurrentStep( 'setup' );
				setSelectedFilter( initialFilter.key );
				setSelectedConfig( initialFilter.config );
				setTempValue( initialFilter.value );
			} else {
				setCurrentStep( 'selection' );
				setSelectedFilter( null );
				setSelectedConfig( null );
				setTempValue( '' );
			}
		}
	}, [ isOpen, initialFilter ]);

	const handleSelectFilter = ( filterKey: string, config: FilterConfig ) => {
		setSelectedFilter( filterKey );
		setSelectedConfig( config );
		setCurrentStep( 'setup' );

		const activeFilters = getActiveFilters();
		setTempValue( activeFilters[filterKey] || '' );
	};

	const handleBack = () => {
		setCurrentStep( 'selection' );
		setSelectedFilter( null );
		setSelectedConfig( null );
		setTempValue( '' );
	};

	const handleApply = ( filterKey: string, value: string ) => {
		if ( '' === value || null === value || value === undefined ) {
			deleteFilter( filterKey );
		} else {
			setFilters( filterKey, value );
		}
		onClose();
	};

	const handleApplyClick = () => {
		if ( selectedFilter ) {
			handleApply( selectedFilter, tempValue );
		}
	};

	const handleResetToDefaults = () => {
		clearAllFilters();
		onClose();
	};

	const getFilterDescription = (): string => {
		if ( 'setup' !== currentStep || ! selectedConfig ) {
			return '';
		}

		if ( 'string' === selectedConfig.type ) {
			return selectedConfig.options ?
				__(
					'Start typing to search or select from available options',
					'burst-statistics'
				) :
				__(
					'Enter the value you want to filter by',
					'burst-statistics'
				);
		} else if ( 'int' === selectedConfig.type ) {
			return __( 'Set the range for this filter', 'burst-statistics' );
		} else if ( 'boolean' === selectedConfig.type ) {
			return __(
				'Select the option you want to filter by',
				'burst-statistics'
			);
		}
		return '';
	};

	const renderContent = (): React.ReactNode => {
		if ( 'selection' === currentStep ) {
			return (
				<FilterSelectionView
					onSelectFilter={handleSelectFilter}
					reportBlockIndex={reportBlockIndex}
				/>
			);
		}

		if ( ! selectedFilter || ! selectedConfig ) {
			return null;
		}

		return (
			<FilterSetupView
				filterKey={selectedFilter}
				config={selectedConfig}
				onBack={handleBack}
				tempValue={tempValue + ''}
				onTempValueChange={setTempValue}
			/>
		);
	};

	const renderHeader = (): React.ReactNode => {
		if ( 'setup' === currentStep && selectedConfig ) {
			return (
				<div>
					<div className="flex items-center gap-3 mb-4">
						<button
							onClick={handleBack}
							className="flex items-center gap-2 text-sm text-text-gray-light hover:text-text-gray focus:outline-hidden focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded transition-all duration-200"
							aria-label={__( 'Back to filters', 'burst-statistics' )}
							type="button"
						>
							<Icon name="chevron-left" size={16} aria-hidden="true" />
							<span>{__( 'Back to filters', 'burst-statistics' )}</span>
						</button>
					</div>
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
							<Icon name={selectedConfig.icon} color="gray" size={20} />
						</div>
						<div>
							<h3 className="text-lg font-semibold text-text-gray">
								{selectedConfig.label}
							</h3>
							<p className="text-sm text-text-gray-light">
								{getFilterDescription()}
							</p>
						</div>
					</div>
				</div>
			);
		}

		return (
			<h5 className="m-0 text-base font-semibold text-text-black">
				{__( 'Select a filter', 'burst-statistics' )}
			</h5>
		);
	};

	const renderFooter = (): React.ReactNode => {
		if ( 'selection' === currentStep ) {
			return (
				<ButtonInput
					onClick={handleResetToDefaults}
					btnVariant="tertiary"
					size="sm"
					className="w-full"
					ariaLabel={__(
						'Reset all active filters to default settings',
						'burst-statistics'
					)}
				>
					{__( 'Reset all filters', 'burst-statistics' )}
				</ButtonInput>
			);
		}

		return (
			<div className="flex justify-end gap-3 w-full">
				<ButtonInput
					onClick={handleApplyClick}
					btnVariant="primary"
					size="md"
					className=""
					ariaLabel={__( 'Apply filter', 'burst-statistics' )}
				>
					{__( 'Apply filter', 'burst-statistics' )}
				</ButtonInput>
			</div>
		);
	};

	return (
		<div className="flex flex-col min-h-0">
			<div className="border-b border-gray-100 px-4 py-3 shrink-0">
				{renderHeader()}
			</div>
			<div className="px-4 py-4 overflow-y-auto min-h-0">
				{renderContent()}
			</div>
			<div className="flex gap-2 rounded-b-lg border-t border-gray-100 bg-gray-50 px-4 py-3 shrink-0">
				{renderFooter()}
			</div>
		</div>
	);
};

export default FilterPopoverContent;
