import React from 'react';
import { __ } from '@wordpress/i18n';
import { useWizardStore } from '@/store/reports/useWizardStore';
import { ContentBlockId } from '@/store/reports/types';
import { BlockComment } from './BlockComment';

interface PreviewBlockControlsProps {
	blockId: ContentBlockId;
	reportBlockIndex: number;
	isEditor?: boolean;
	isEditingMode?: boolean;
	isSelected?: boolean;
	children: React.ReactNode;
}

const renderPreviewBlockContent = ({
	children,
	reportBlockIndex,
	showCommentColumn
}: {
	children: React.ReactNode;
	reportBlockIndex: number;
	showCommentColumn: boolean;
}) => (
	<div className="grid grid-cols-1 @md:grid-cols-12 gap-2 mx-auto">
		<div className="@md:col-span-7">
			<div className={showCommentColumn ? 'group relative p-1 border border-transparent' : 'group relative border border-transparent'}>
				{children}
			</div>
		</div>

		{showCommentColumn && (
			<div className="@md:col-span-5 flex flex-row items-end gap-2 p-1">
				<BlockComment reportBlockIndex={reportBlockIndex} isEditingMode={false} />
			</div>
		)}
	</div>
);

const SelectableBlockFrame = ({
	children,
	isSelected,
	onClick,
	className
}: {
	children: React.ReactNode;
	isSelected: boolean;
	onClick: ( e: React.MouseEvent ) => void;
	className: string;
}) => {
	return (
		<div
			className={className}
			onClick={onClick}
			role="button"
			tabIndex={0}
			onKeyDown={( e ) => {
				if ( 'Enter' === e.key || ' ' === e.key ) {
					e.preventDefault();
					onClick( e as unknown as React.MouseEvent );
				}
			}}
			aria-pressed={isSelected}
			aria-label={__( 'Select block to edit settings', 'burst-statistics' )}
		>
			{children}
		</div>
	);
};

/**
 * Wrapper component for block preview with selection and metadata display.
 */
// fallow-ignore-next-line complexity
export const PreviewBlockControls: React.FC<PreviewBlockControlsProps> = ({
	blockId,
	reportBlockIndex,
	isEditingMode = false,
	isSelected = false,
	children
}) => {
	const setSelectedBlockIndex = useWizardStore( ( state ) => state.setSelectedBlockIndex );

	/**
	 * Handle block click to select it in editing mode.
	 */
	const handleBlockClick = ( e: React.MouseEvent ) => {
		if ( isEditingMode ) {
			e.stopPropagation();
			setSelectedBlockIndex( reportBlockIndex );
		}
	};

	const FULL_WIDTH_BLOCKS = [ 'hero', 'text_block', 'footer' ];

	// Full-width blocks: no comment column.
	if ( FULL_WIDTH_BLOCKS.includes( blockId ) ) {
		if ( ! isEditingMode ) {
			return <div className="w-full">{children}</div>;
		}

		const fullWidthClassName = isSelected ?
			'border-gray-400' :
			'border-transparent hover:border-gray-300 hover:bg-gray-50/50';

		return (
			<SelectableBlockFrame
				className={`p-1 mb-4 rounded-xl border-2 transition-all duration-200 cursor-pointer ${fullWidthClassName}`}
				isSelected={isSelected}
				onClick={handleBlockClick}
			>
				{children}
			</SelectableBlockFrame>
		);
	}

	// Non-editing mode: show block with comment.
	if ( ! isEditingMode ) {
		return (
			<div className="mb-4">
				{renderPreviewBlockContent({
					children,
					reportBlockIndex,
					showCommentColumn: true
				})}
			</div>
		);
	}

	// Editing mode: clickable block with selection state and metadata.
	const blockClassName = isSelected ?
		'border-gray-400' :
		'border-transparent hover:border-gray-300 hover:bg-gray-50/50';

	return (
		<SelectableBlockFrame
			className={`p-1 mb-4 rounded-xl border-2 transition-all duration-200 cursor-pointer  ${blockClassName}`}
			isSelected={isSelected}
			onClick={handleBlockClick}
		>
			{renderPreviewBlockContent({
				children,
				reportBlockIndex,
				showCommentColumn: true
			})}
		</SelectableBlockFrame>
	);
};
