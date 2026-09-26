import FieldWrapper from '@/components/Fields/FieldWrapper';
import { memo, useRef, useState } from 'react';
import useLicenseData from '@/hooks/useLicenseData';
import ProBadge from '@/components/Common/ProBadge';
import AiSummaryUnavailableBadge from './AiSummaryUnavailableBadge';
import { useAiSummaryAvailability } from '@/hooks/useChatAvailability';
import { ContentBlockId, ContentItem } from '@/store/reports/types';
import Icon from '@/utils/Icon';
import { motion, AnimatePresence } from 'framer-motion';
import {
	getSelectableContentBlocks,
	useContentSelectionFormSync,
	useReportWizardSelectionData
} from './contentSelectionHelpers';

interface AnimatingBlock {
	block: ContentItem;
	startX: number;
	startY: number;
}

/**
 * Story content selection component.
 * Displays a grid of content blocks with plus buttons for adding blocks to the story.
 */
const StoryContentSelection = () => {
	const {
		availableContent,
		content,
		addContent,
		shouldLoadEcommerce
	} = useReportWizardSelectionData();

	const { isLicenseValidFor } = useLicenseData();
	const isAgency = isLicenseValidFor( 'reporting' );
	const { isDisabled: isAiSummaryDisabled, disabledReason: aiSummaryDisabledReason } = useAiSummaryAvailability();
	const [ animatingBlock, setAnimatingBlock ] = useState<AnimatingBlock | null>( null );
	const containerRef = useRef<HTMLDivElement>( null );
	const { errors } = useContentSelectionFormSync( content );

	// fallow-ignore-next-line complexity
	const handleClick = ( blockId: ContentBlockId, event: React.MouseEvent<HTMLButtonElement> ) => {
		const block = availableContent.find( item => item.id === blockId );
		if ( ! block || ( block.pro && ! isAgency ) || ( 'ai_summary' === blockId && isAiSummaryDisabled ) ) {
			return;
		}

		// Get the button position for animation.
		const buttonRect = event.currentTarget.getBoundingClientRect();
		const containerRect = containerRef.current?.getBoundingClientRect();

		if ( containerRect ) {
			setAnimatingBlock({
				block,
				startX: buttonRect.left - containerRect.left,
				startY: buttonRect.top - containerRect.top
			});

			// Clear animation after it completes.
			setTimeout( () => {
				setAnimatingBlock( null );
			}, 600 );
		}

		addContent( blockId );
	};
	return (
		<FieldWrapper error={errors.content?.message as string} label="" inputId="content_selection" fullWidthContent={ true } className="!pt-0 !px-0">
			<div ref={containerRef} data-tour="wizard-story-blocks" className="relative grid grid-cols-2 gap-3 py-4">
				{
					getSelectableContentBlocks( availableContent, shouldLoadEcommerce, 'story' )
						.filter( ( block ) => ! block.pro || isAgency )

						// fallow-ignore-next-line complexity
						.map( ( block:ContentItem, index ) => {
							const isBlockProDisabled = block.pro && ! isAgency;
							const isAiDisabled = 'ai_summary' === block.id && isAiSummaryDisabled;
							const isBlockDisabled = isBlockProDisabled || isAiDisabled;
							const cardClassName = `
								relative flex flex-col items-center justify-center min-h-[82px] gap-3 p-4 bg-white rounded-lg ring-1 ring-gray-400 transition-all shadow-layered-low-b
								${isBlockDisabled ? 'cursor-not-allowed' : 'cursor-pointer hover:ring-gray-500 hover:scale-105 hover:shadow-layered-mid-b'}
							`;
							const cardContent = (
								<>
									{block.icon && (
										<div className={`shrink-0 text-text-gray-light ${isBlockDisabled ? 'opacity-50' : ''}`}>
											<Icon name={block.icon} size={18} />
										</div>
									)}
									<p className={`flex-1 text-sm text-text-gray text-center whitespace-nowrap ${isBlockDisabled ? 'opacity-50' : ''}`}>
										{block.label}
									</p>
									{
										isBlockProDisabled && (
											<div className="absolute top-2 right-2">
												<ProBadge label={'Pro'}/>
											</div>
										)
									}
									{
										isAiDisabled && aiSummaryDisabledReason && (
											<div className="absolute top-2 right-2">
												<AiSummaryUnavailableBadge reason={aiSummaryDisabledReason} />
											</div>
										)
									}
								</>
							);

							// A disabled card has no action, so it is not a button: a disabled button swallows the
							// hover and focus events the unavailable-badge tooltip needs, and a button may not contain a focusable element.
							if ( isBlockDisabled ) {
								return (
									<div
										key={index}
										aria-disabled="true"
										data-tour-block={block.id}
										className={cardClassName}
									>
										{cardContent}
									</div>
								);
							}

							return (
								<button
									key={index}
									type="button"
									data-tour="wizard-add-block-btn"
									data-tour-block={block.id}
									onClick={( e ) => handleClick( block.id, e )}

									// grow on hover
									className={cardClassName}
								>
									{cardContent}
								</button>
							);
						})
				}

				{/* Animated duplicate block. */}
				<AnimatePresence>
					{animatingBlock && (
						<motion.div
							initial={{
								position: 'absolute',
								left: animatingBlock.startX,
								top: animatingBlock.startY,
								opacity: 1,
								scale: 1,
								zIndex: 150
							}}
							animate={{
								left: '200%',
								top: '100%',
								opacity: 0,
								scale: 0.5
							}}
							exit={{ opacity: 0 }}
							transition={{
								duration: 0.5,
								ease: 'easeInOut'
							}}
							className="flex flex-col items-center gap-3 p-4 bg-white rounded-lg ring-1 ring-gray-400 shadow-layered-mid-b pointer-events-none z-10"
							style={{ width: 'calc(50% - 6px)' }}
						>
							{animatingBlock.block.icon && (
								<div className="shrink-0 text-text-gray-light">
									<Icon name={animatingBlock.block.icon} size={18} />
								</div>
							)}
							<p className="flex-1 text-sm text-text-gray">
								{animatingBlock.block.label}
							</p>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</FieldWrapper>
	);
};

export default memo( StoryContentSelection );
