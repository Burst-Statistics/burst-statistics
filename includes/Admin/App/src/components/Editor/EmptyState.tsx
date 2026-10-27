import React from 'react';
import { __ } from '@wordpress/i18n';
import { EditorIcon } from './EditorIcon';

/**
 * Empty state displayed when a post is unpublished (draft) or has received zero visits yet.
 *
 * @return Styled empty state container matching mockup.
 */
export const EmptyState: React.FC = () => (
	<div className="flex flex-col items-center justify-center py-10 px-4 text-center">
		<div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-50 mb-3">
			<EditorIcon
				size={ 28 }
				strokeWidth={ 1.75 }
				className="text-gray-400"
			/>
		</div>
		<h3 className="mb-1 text-sm font-semibold text-text-black">
			{ __( 'No visits yet', 'burst-statistics' ) }
		</h3>
		<p className="max-w-[220px] text-xs leading-relaxed text-text-gray">
			{ __(
				'Statistics show up here once this post is published and gets its first visitor.',
				'burst-statistics'
			) }
		</p>
	</div>
);
