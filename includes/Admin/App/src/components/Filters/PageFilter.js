import { useState } from 'react';
import useFilterDisplay from '../../hooks/useFilterDisplay';
import { FilterChipList, AddFilterButton } from '../Filters/Display';
import { FilterModal } from '../Filters/Modal';
import useShareableLinkStore from '@/store/useShareableLinkStore';


/**
 * PageFilter component displays active filters and provides interface to add/remove them
 *
 * @return {JSX.Element} PageFilter component
 */
export const PageFilter = ( props ) => {
	const smallLabels = props.smallLabels ?? false;
	const reportBlockIndex = props.reportBlockIndex ?? undefined;
	const isReport = props.isReport ?? false;
	const userCanFilter = useShareableLinkStore( ( state ) => state.userCanFilter );
	const [ isModalOpen, setIsModalOpen ] = useState( false );
	const [ editingFilter, setEditingFilter ] = useState( null );
	const { activeFilters, removeFilter } = useFilterDisplay( reportBlockIndex );

	/**
	 * Handle opening the filter modal for adding new filters
	 */
	const handleAddFilterClick = () => {
		setEditingFilter( null );
		setIsModalOpen( true );
	};

	/**
	 * Handle clicking on a filter chip to edit it
	 * @param {Object} filter - The filter object to edit
	 */
	const handleEditFilterClick = ( filter ) => {
		setEditingFilter({
			key: filter.key,
			config: filter.config,
			value: filter.value
		});
		setIsModalOpen( true );
	};

	/**
	 * Handle modal close - reset editing state
	 */
	const handleModalClose = () => {
		setIsModalOpen( false );
		setEditingFilter( null );
	};
	return (
		<div className="flex flex-wrap items-center gap-2">
			{/* Render active filter chips */}
			<FilterChipList
				isReport = {isReport}
				filters={activeFilters}
				onRemove={removeFilter}
				onClick={handleEditFilterClick}
				smallLabels={smallLabels}
				className="flex flex-wrap gap-2"
			/>

			{/* Add filter button */}
			{ userCanFilter && ! isReport && <>
				<AddFilterButton smallLabels={smallLabels} onClick={handleAddFilterClick} />

				{/* Filter modal */}
				<FilterModal
					isOpen={isModalOpen}
					setIsOpen={handleModalClose}
					initialFilter={editingFilter}
					reportBlockIndex={reportBlockIndex}
				/>
			</> }
		</div>
	);
};
