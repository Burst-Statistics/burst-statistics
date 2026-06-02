import React, { useMemo } from 'react';
import { useWizardStore } from '@/store/reports/useWizardStore';
import { useTheme } from '@/hooks/useTheme';
import { AdminWysiwygField } from '@/components/Fields/Wysiwyg/WysiwygField';
import WysiwygPreview from '@/components/Common/WysiwygPreview';
import { BlockComponentProps } from '@/store/reports/types';

const TEXT_BLOCK_SETTING = { id: 'text_block' };

const TextBlock: React.FC<BlockComponentProps> = ({ reportBlockIndex = 0 }) => {
	const isEditingMode = useWizardStore( ( state ) => state.isEditingMode );
	const content = useWizardStore( ( state ) => state.wizard.content[ reportBlockIndex ]?.content ?? '' );
	const updateComment = useWizardStore( ( state ) => state.updateComment );
	const { isDarkTheme } = useTheme();

	const field = useMemo( () => ({
		value: content,
		onChange: ( value: string ) => updateComment( reportBlockIndex, value ),
		name: `text_block_${ reportBlockIndex }`
	}), [ content, reportBlockIndex, updateComment ]);

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
