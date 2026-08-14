import { useState } from 'react';
import * as ReactPopover from '@radix-ui/react-popover';
import { __ } from '@wordpress/i18n';
import useFilterDisplay from '../../hooks/useFilterDisplay';
import { FilterChipList, AddFilterButton } from '../Filters/Display';
import { FilterPopoverContent } from '../Filters/Modal';
import useShareableLinkStore from '@/store/useShareableLinkStore';
import IconButton from '@/components/Inputs/IconButton';
import Tooltip from '@/components/Common/Tooltip';

/**
 * PageFilter component displays active filters and provides a popover interface
 * to add or edit them, styled consistently with the DateRange popover.
 *
 * @param {Object} props - Component props.
 * @param {boolean} [props.smallLabels] - Whether to use small size styling.
 * @param {number} [props.reportBlockIndex] - Optional report block index.
 * @param {boolean} [props.isReport] - Whether rendering in report context.
 * @return {JSX.Element} PageFilter component.
 */
// fallow-ignore-next-line complexity
export const PageFilter = ( props ) => {
	const smallLabels = props.smallLabels ?? false;
	const reportBlockIndex = props.reportBlockIndex ?? undefined;
	const isReport = props.isReport ?? false;
	const userCanFilter = useShareableLinkStore( ( state ) => state.userCanFilter );
	const userCanManage = 'undefined' !== typeof burst_settings ? Boolean( burst_settings.manage_burst_statistics ) : false;

	const [ isOpen, setIsOpen ] = useState( false );
	const [ editingFilter, setEditingFilter ] = useState( null );
	const {
		activeFilters,
		hasActiveFilters,
		removeFilter,
		isPinned,
		savePinnedFilters,
		clearPinnedFilters
	} = useFilterDisplay( reportBlockIndex );

	const handleAddFilterClick = () => {
		setEditingFilter( null );
		setIsOpen( true );
	};

	const handleChipClick = ( filter ) => {
		setEditingFilter( filter );
		setIsOpen( true );
	};

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
			{isOpen && userCanFilter && ! isReport && (
				<div className="fixed inset-0 bg-black/30 z-[55]" />
			)}

			<ReactPopover.Root
				open={isOpen && userCanFilter && ! isReport}
				onOpenChange={( open ) => ! open && handleClose()}
			>
				<ReactPopover.Anchor asChild>
					<div className={`flex flex-wrap items-center gap-2${isOpen ? ' relative z-[60]' : ''}`}>
						<FilterChipList
							isHighlighted={isOpen}
							isReport={isReport}
							filters={activeFilters}
							onRemove={removeFilter}
							onClick={handleChipClick}
							smallLabels={smallLabels}
							className="flex flex-wrap gap-2"
						/>

						{userCanFilter && ! isReport && (
							<>
								<AddFilterButton
									isHighlighted={isOpen}
									smallLabels={smallLabels}
									hasActiveFilters={hasActiveFilters}
									onClick={handleAddFilterClick}
								/>

								{userCanManage && ( hasActiveFilters || isPinned ) && (
									<Tooltip
										content={
											isPinned ?
												__( 'Pinned as default filters across sessions (click to unpin)', 'burst-statistics' ) :
												__( 'Pin active filters as default across sessions', 'burst-statistics' )
										}
									>
										<IconButton
											icon={isPinned ? 'pin-off' : 'pin'}
											ariaLabel={
												isPinned ?
													__( 'Unpin default filters', 'burst-statistics' ) :
													__( 'Pin default filters', 'burst-statistics' )
											}
											onClick={isPinned ? clearPinnedFilters : () => savePinnedFilters()}
											className={
												isPinned ?
													'burst-button burst-button--secondary text-primary border-primary font-medium' :
													'burst-button burst-button--secondary text-text-gray hover:text-text-black'
											}
											size={smallLabels ? 'sm' : 'lg'}
										/>
									</Tooltip>
								)}
							</>
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
							onInteractOutside={( e ) => {
								if ( e.target && e.target.closest && e.target.closest( '[data-radix-popper-content-wrapper], [role="listbox"], [role="option"]' ) ) {
									e.preventDefault();
								}
							}}
							onPointerDownOutside={( e ) => {
								if ( e.target && e.target.closest && e.target.closest( '[data-radix-popper-content-wrapper], [role="listbox"], [role="option"]' ) ) {
									e.preventDefault();
								}
							}}
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
