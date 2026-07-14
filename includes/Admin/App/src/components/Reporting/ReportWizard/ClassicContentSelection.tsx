import FieldWrapper from '@/components/Fields/FieldWrapper';
import { memo } from 'react';
import useLicenseData from '@/hooks/useLicenseData';
import ProBadge from '@/components/Common/ProBadge';
import { ContentBlockId, ContentItem } from '@/store/reports/types';
import Icon from '@/utils/Icon';
import {
	getSelectableContentBlocks,
	useContentSelectionFormSync,
	useReportWizardSelectionData
} from './contentSelectionHelpers';

/**
 * Classic content selection component.
 * Displays a grid of content blocks with checkboxes for enabling/disabling blocks.
 */
const ClassicContentSelection = () => {
	const {
		availableContent,
		content,
		addContent,
		removeContent,
		shouldLoadEcommerce
	} = useReportWizardSelectionData();

	const { isPro, isLicenseValid } = useLicenseData();
	const { errors } = useContentSelectionFormSync( content );

	const isSelected = ( blockId:ContentBlockId ) => {
		return content.some( item => item.id === blockId );
	};

	const handleToggle = ( block: ContentItem ) => {
		if ( block.pro && ( ! isLicenseValid || ! isPro ) ) {
			return;
		}

		const index = content.findIndex( item => item.id === block.id );
		if ( -1 === index ) {
			addContent( block.id );
		} else {
			removeContent( index );
		}
	};

	return (
		<FieldWrapper error={errors.content?.message as string} label="" inputId="content_selection" fullWidthContent={ true } className="!pt-0 !px-0">
			<div className="flex flex-col gap-3 py-4">
				{
					getSelectableContentBlocks( availableContent, shouldLoadEcommerce, false )

						// fallow-ignore-next-line complexity
						.map( ( block:ContentItem, index ) => {
							const isBlockSelected = isSelected( block.id );
							const isBlockProDisabled = block.pro && ( ! isLicenseValid || ! isPro );

							return (
								<div
									key={index}
									onClick={() => handleToggle( block )}
									className={`
										flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all
										${isBlockSelected ? 'border-green bg-green-50' : 'border-gray-200 hover:border-gray-300 bg-white'}
										${isBlockProDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}
									`}
								>
									{block.icon && (
										<div className={`shrink-0 ${isBlockSelected ? 'text-green' : 'text-text-gray-light'}`}>
											<Icon name={block.icon} size={18} />
										</div>
									)}
									<label htmlFor={block.id} className="flex-1 text-sm text-text-gray cursor-pointer">
										{block.label}
									</label>
									{
										block.pro && ! isLicenseValid && (
											<div className="shrink-0">
												<ProBadge label={'Pro'}/>
											</div>
										)
									}
									<div className="shrink-0">
										<input
											type="checkbox"
											id={block.id}
											checked={isBlockSelected}
											onChange={() => {
handleToggle( block );
}}
											onClick={( e ) => {
												e.stopPropagation();
											}}
											className="h-4 w-4 text-green border-gray-300 rounded focus:ring-2 focus:ring-blue"
											disabled={ isBlockProDisabled }
										/>
									</div>
								</div>
							);
						})
				}
			</div>
		</FieldWrapper>
	);
};

export default memo( ClassicContentSelection );
