import FieldWrapper from '@/components/Fields/FieldWrapper';
import { memo } from 'react';
import * as Checkbox from '@radix-ui/react-checkbox';
import clsx from 'clsx';
import useLicenseData from '@/hooks/useLicenseData';
import ProBadge from '@/components/Common/ProBadge';
import AiSummaryUnavailableBadge from './AiSummaryUnavailableBadge';
import { useAiSummaryAvailability } from '@/hooks/useChatAvailability';
import { ContentBlockId, ContentItem } from '@/store/reports/types';
import Icon from '@/utils/Icon';
import {
	getSelectableContentBlocks,
	useContentSelectionFormSync,
	useReportWizardSelectionData
} from './contentSelectionHelpers';

/**
 * Classic content selection component.
 * Displays a list of content blocks with checkboxes for enabling/disabling blocks.
 * Each block is a label wrapping its checkbox, so a click anywhere on the block toggles it.
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
	const { isDisabled: isAiSummaryDisabled, disabledReason: aiSummaryDisabledReason } = useAiSummaryAvailability();

	const isSelected = ( blockId:ContentBlockId ) => {
		return content.some( item => item.id === blockId );
	};

	const handleToggle = ( block: ContentItem ) => {
		if ( 'ai_summary' === block.id && isAiSummaryDisabled ) {
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
					getSelectableContentBlocks( availableContent, shouldLoadEcommerce, 'classic' )

						// fallow-ignore-next-line complexity
						.map( ( block:ContentItem ) => {
							const isBlockSelected = isSelected( block.id );
							const isAiDisabled = 'ai_summary' === block.id && isAiSummaryDisabled;
							const isBlockProDisabled = block.pro && ( ! isLicenseValid || ! isPro );
							const isBlockDisabled = isBlockProDisabled || isAiDisabled;

							return (
								<label
									key={block.id}
									className={clsx(
										'flex items-center gap-3 p-4 rounded-lg border transition-all',
										isBlockSelected ? 'border-green bg-green-50' : 'border-gray-200 bg-white',
										isBlockDisabled ?
											'cursor-not-allowed' :
											'cursor-pointer hover:border-gray-300 hover:bg-gray-50'
									)}
								>
									{/* Fade only the block itself, so the unavailable badge stays readable. */}
									{block.icon && (
										<div className={clsx( 'shrink-0', isBlockSelected ? 'text-green' : 'text-text-gray-light', isBlockDisabled && 'opacity-50' )}>
											<Icon name={block.icon} size={18} />
										</div>
									)}
									<div className={clsx( 'flex-1 min-w-0', isBlockDisabled && 'opacity-50' )}>
										<span className="block text-sm text-text-gray">
											{block.label}
										</span>
									</div>
									{isAiDisabled && aiSummaryDisabledReason && (
										<AiSummaryUnavailableBadge reason={aiSummaryDisabledReason} />
									)}
									{
										block.pro && ! isLicenseValid && (
											<div className="shrink-0">
												<ProBadge label={'Pro'}/>
											</div>
										)
									}
									<Checkbox.Root
										id={block.id}
										checked={isBlockSelected}
										disabled={isBlockDisabled}
										onCheckedChange={() => {
											if ( ! isBlockDisabled ) {
												handleToggle( block );
											}
										}}
										className="flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 border-gray-300 bg-white transition-colors hover:border-gray-400 focus:outline-hidden focus:ring-2 focus:ring-blue data-[state=checked]:border-green disabled:cursor-not-allowed disabled:opacity-50"
									>
										<Checkbox.Indicator>
											<Icon name="check" size={14} color="green" strokeWidth={2} />
										</Checkbox.Indicator>
									</Checkbox.Root>
								</label>
							);
						})
				}
			</div>
		</FieldWrapper>
	);
};

export default memo( ClassicContentSelection );
