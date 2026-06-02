import { useState } from 'react';
import * as ReactPopover from '@radix-ui/react-popover';
import useFilterDisplay from '../../hooks/useFilterDisplay';
import { FilterChipList, AddFilterButton } from '../Filters/Display';
import { FilterPopoverContent } from '../Filters/Modal';
import useShareableLinkStore from '@/store/useShareableLinkStore';

/**
 * PageFilter component displays active filters and provides a popover interface
 * to add or edit them, styled consistently with the DateRange popover.
 *
 * @return {JSX.Element} PageFilter component.
 */
export const PageFilter = ( props ) => {
	const smallLabels = props.smallLabels ?? false;
	const reportBlockIndex = props.reportBlockIndex ?? undefined;
	const isReport = props.isReport ?? false;
	const userCanFilter = useShareableLinkStore( ( state ) => state.userCanFilter );

	const [ isOpen, setIsOpen ] = useState( false );
	const [ editingFilter, setEditingFilter ] = useState( null );
	const { activeFilters, removeFilter } = useFilterDisplay( reportBlockIndex );

	/**
	 * Open the popover for adding a new filter.
	 */
	const handleAddFilterClick = () => {
		setEditingFilter( null );
		setIsOpen( true );
	};

	/**
	 * Open the popover in edit mode for an existing filter chip.
	 *
	 * @param {Object} filter - The filter object to edit.
	 */
	const handleEditFilterClick = ( filter ) => {
		setEditingFilter({
			key: filter.key,
			config: filter.config,
			value: filter.value
		});
		setIsOpen( true );
	};

	/**
	 * Close the popover and reset editing state.
	 */
	const handleClose = () => {
		setIsOpen( false );
		setEditingFilter( null );
	};

	const portalContainer =
		document.getElementById( 'modal-root' ) ||
		document.querySelector( '.burst' ) ||
		document.body;

	return (
		<>
			{isOpen && userCanFilter && (
				<div className="fixed inset-0 bg-black/30 z-[55]" />
			)}

			<ReactPopover.Root
				open={isOpen && userCanFilter && ! isReport}
				onOpenChange={( open ) => ! open && handleClose()}
			>
				{/* Anchor spans the entire filter row for consistent popover positioning. */}
				<ReactPopover.Anchor asChild>
					<div className={`flex flex-wrap items-center gap-2${isOpen ? ' relative z-[60]' : ''}`}>
						<FilterChipList
							isHighlighted={isOpen}
							isReport={isReport}
							filters={activeFilters}
							onRemove={removeFilter}
							onClick={handleEditFilterClick}
							smallLabels={smallLabels}
							className="flex flex-wrap gap-2"
						/>

						{userCanFilter && ! isReport && (
							<AddFilterButton
								isHighlighted={isOpen}
								smallLabels={smallLabels}
								onClick={handleAddFilterClick}
							/>
						)}
					</div>
				</ReactPopover.Anchor>

				{userCanFilter && ! isReport && (
					<ReactPopover.Portal container={portalContainer}>
						<ReactPopover.Content
							className="z-[10001] w-[700px] max-w-[calc(100vw-40px)] max-h-[80vh] rounded-lg border border-gray-200 bg-white shadow-xl flex flex-col"
							align="start"
							sideOffset={10}
							arrowPadding={10}
						>
							<FilterPopoverContent
								isOpen={isOpen}
								onClose={handleClose}
								initialFilter={editingFilter}
								reportBlockIndex={reportBlockIndex}
							/>
						</ReactPopover.Content>
					</ReactPopover.Portal>
				)}
			</ReactPopover.Root>
		</>
	);
};
