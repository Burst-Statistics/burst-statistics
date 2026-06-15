import React from 'react';
import { BlockComment } from './BlockComment';

interface StoryBlockWrapperProps {
	children: React.ReactNode;
	reportBlockIndex: number;
	blockId: string;
}

const FULL_WIDTH_BLOCKS = [ 'hero', 'text_block', 'footer' ];

export const StoryBlockWrapper: React.FC<StoryBlockWrapperProps> = ({
	children,
	reportBlockIndex,
	blockId
}) => {
	if ( FULL_WIDTH_BLOCKS.includes( blockId ) ) {
		return <div className="w-full">{ children }</div>;
	}

	return (
		<div className="w-full burst-story-content-width">
			<div className="mb-4 grid grid-cols-1 @md:grid-cols-12 gap-2">
				<div className="@md:col-span-7">
					<div className="group relative border border-transparent">
						{ children }
					</div>
				</div>
				<div className="@md:col-span-5 flex flex-row items-end gap-2 p-2">
					<BlockComment reportBlockIndex={ reportBlockIndex } isEditingMode={ false } />
				</div>
			</div>
		</div>
	);
};
