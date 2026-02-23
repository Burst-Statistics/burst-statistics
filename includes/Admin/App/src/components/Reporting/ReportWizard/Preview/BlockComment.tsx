import React, { useRef, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { useWizardStore } from '@/store/reports/useWizardStore';
import TextInput from '@/components/Inputs/TextInput';
import Icon from '@/utils/Icon';

interface BlockCommentProps {
	reportBlockIndex: number;
	isEditingMode?: boolean;
}

/**
 * Component for displaying and editing block comments.
 */
export const BlockComment: React.FC<BlockCommentProps> = ({ reportBlockIndex, isEditingMode = false }) => {
	const updateCommentTitle = useWizardStore( ( state ) => state.updateCommentTitle );
	const updateCommentText = useWizardStore( ( state ) => state.updateCommentText );
	const commentTitle = useWizardStore( ( state ) => state.wizard.content[reportBlockIndex]?.comment_title ?? '' );
	const commentText = useWizardStore( ( state ) => state.wizard.content[reportBlockIndex]?.comment_text ?? '' );
	const hasContent = commentTitle || commentText;
	const textareaRef = useRef<HTMLTextAreaElement>( null );

	const [ isExpanded, setIsExpanded ] = useState<boolean>( !! hasContent );

	const removeComment = () => {
		setIsExpanded( false );
		updateCommentTitle( reportBlockIndex, '' );
		updateCommentText( reportBlockIndex, '' );
	};

	// Don't show anything if there's no comment in preview mode.
	if ( ! isEditingMode && ! commentText && ! commentTitle ) {
		return null;
	}

	if ( isEditingMode ) {

		// Show add comment button when collapsed and no content.
		if ( ! isExpanded && ! hasContent ) {
			return (
				<button
					onClick={() => setIsExpanded( true )}
					className="w-full p-4 rounded-xl bg-wp-gray shadow-sm border border-gray-300 hover:border-gray-400 hover:bg-white transition-colors duration-200 flex items-center justify-center gap-2 text-gray-600 hover:text-gray-800"
				>
					<Icon name="plus" size={16} />
					<span className="text-sm font-medium">{__( 'Add comment', 'burst-statistics' )}</span>
				</button>
			);
		}

		// Show full form when expanded or has content.
		return (
			<div className="p-4 rounded-xl bg-white shadow-sm relative border border-gray-300 w-full">
				<div className="mb-3">
					<TextInput
						value={commentTitle || ''}
						onChange={( e ) => updateCommentTitle( reportBlockIndex, e.target.value )}
						placeholder={__( 'Comment title (optional)', 'burst-statistics' )}
						className="text-sm font-semibold"
					/>
				</div>
				<div>
					<textarea
						value={commentText || ''}
						ref={textareaRef}
						onChange={( e ) => updateCommentText( reportBlockIndex, e.target.value )}
						placeholder={__( 'Add your insights or comments about this data...', 'burst-statistics' )}
						className="w-full min-h-[100px] p-2 text-sm text-gray-600 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
						rows={4}
					/>
				</div>
				<div className="flex flex-col gap-2 mt-2">
					<p className="text-xs text-gray-500">
						{__( 'This comment will appear next to the block in the report. If there is not enough space, the comment will be shown below the block.', 'burst-statistics' )}
					</p>

					<button
						onClick={() => removeComment()}
						className="ml-auto text-xs text-gray-600 hover:text-gray-700 bg-gray-50 border border-gray-300 rounded-md p-1 hover:bg-gray-100 hover:border-gray-400 transition-colors duration-200 whitespace-nowrap flex items-center gap-1"
					>
						<Icon name="trash" size={13} className='opacity-50' />
						{__( 'Remove comment', 'burst-statistics' )}
					</button>
				</div>
			</div>
		);
	}

	// Preview mode - only show if there's content.
	return (
		<div className="p-4 rounded-xl bg-white shadow-sm relative border border-gray-300 w-full">
			{commentTitle && (
				<p className="text-gray-700 text-sm font-semibold mb-2">
					{commentTitle}
				</p>
			)}
			{commentText && (
				<p className="text-gray-600 text-sm whitespace-pre-wrap">
					{commentText}
				</p>
			)}
		</div>
	);
};
