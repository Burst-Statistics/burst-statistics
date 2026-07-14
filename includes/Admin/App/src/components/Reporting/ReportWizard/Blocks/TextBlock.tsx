import React from 'react';
import { useTheme } from '@/hooks/useTheme';
import { AdminWysiwygField } from '@/components/Fields/Wysiwyg/WysiwygField';
import WysiwygPreview from '@/components/Common/WysiwygPreview';
import { BlockComponentProps } from '@/store/reports/types';
import { useReportBlockEditor } from './blockHooks';

const TEXT_BLOCK_SETTING = { id: 'text_block' };

const TextBlock: React.FC<BlockComponentProps> = ({ reportBlockIndex = 0 }) => {
	const { isEditingMode, content, field } = useReportBlockEditor({
		reportBlockIndex,
		fieldName: 'text_block'
	});
	const { isDarkTheme } = useTheme();

	if ( ! isEditingMode && ! content ) {
		return null;
	}

	return (
		<div className="w-full mb-6 burst-story-content-width">
				{ isEditingMode ? (
					<AdminWysiwygField
						field={field}
						fieldState={{}}
						setting={TEXT_BLOCK_SETTING}
						label={undefined}
						help={undefined}
						context={undefined}
						className="w-full p-0"
						fullWidthContent={true}
					/>
				) : (
					<WysiwygPreview html={ content } isDark={ isDarkTheme } />
				) }
		</div>
	);
};

TextBlock.displayName = 'TextBlock';
export default TextBlock;
