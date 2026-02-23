import React from 'react';
import { BlockComment } from './BlockComment';
interface StoryBlockWrapperProps {
	children: React.ReactNode;
	commentTitle?: string;
	commentText?: string;
	reportBlockIndex: number;
}

/**
 * Wrapper component for blocks in the story view.
 * Shows block content with optional comment on the right side.
 */
export const StoryBlockWrapper: React.FC<StoryBlockWrapperProps> = ({
																		children,
																		reportBlockIndex
																	}) => {
	return (
		<>
			<div className="mb-4 grid grid-cols-1 md:grid-cols-12 gap-2 mx-auto w-full">
				<div className="md:col-span-7">
					<div className="group relative p-2 border border-transparent">
						{children}
					</div>
				</div>
				<div className="md:col-span-5 flex flex-row items-end gap-2 p-2">
					<BlockComment reportBlockIndex={reportBlockIndex} isEditingMode={false}/>
				</div>
			</div>
		</>
	);
};
