import { useWizardStore } from '@/store/reports/useWizardStore';
import { __ } from '@wordpress/i18n';
import FieldWrapper from '@/components/Fields/FieldWrapper';
import { useFormContext } from 'react-hook-form';
import { memo, useEffect, useRef, useState } from 'react';
import useLicenseData from '@/hooks/useLicenseData';
import ProBadge from '@/components/Common/ProBadge';
import { useReportConfigStore } from '@/store/reports/useReportConfigStore';
import { ContentBlockId, ContentItem } from '@/store/reports/types';
import Icon from '@/utils/Icon';
import { motion, AnimatePresence } from 'framer-motion';

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
	const availableContent = useReportConfigStore( ( state ) => state.availableContent );
	const content = useWizardStore( ( state ) => state.wizard.content );
	const addContent = useWizardStore( ( state ) => state.addContent );
	const shouldLoadEcommerce = window.burst_settings?.shouldLoadEcommerce || false;

	const { isLicenseValid } = useLicenseData();
	const isFirstRender = useRef( true );
	const [ animatingBlock, setAnimatingBlock ] = useState<AnimatingBlock | null>( null );
	const containerRef = useRef<HTMLDivElement>( null );

	const {
		register,
		setValue,
		formState: { errors }
	} = useFormContext();

	useEffect( () => {
		register( 'content', {
			value: content,
			validate: ( value: string[]) =>
				0 < value.length ||
				__( 'Please select at least one content item', 'burst-statistics' )
		});
	}, [ register, content ]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect( () => {
		if ( isFirstRender.current ) {
			isFirstRender.current = false;
			return;
		}

		setValue( 'content', content, {
			shouldValidate: !! errors.content
		});
	}, [ content, setValue ]); // eslint-disable-line react-hooks/exhaustive-deps

	const handleClick = ( blockId: ContentBlockId, event: React.MouseEvent<HTMLButtonElement> ) => {
		const block = availableContent.find( item => item.id === blockId );
		if ( ! block || ( block.pro && ! isLicenseValid ) ) {
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
			<div ref={containerRef} className="relative grid grid-cols-2 gap-3 py-4">
				{
					availableContent
						.filter( ( block ) => ! block.ecommerce || shouldLoadEcommerce )
						.filter( ( block ) => block.component )
						.map( ( block:ContentItem, index ) => {
							const isBlockProDisabled = block.pro && ! isLicenseValid;

							return (
								<button
									key={index}
									type="button"
									onClick={( e ) => {
										if ( ! isBlockProDisabled ) {
											handleClick( block.id, e );
										}
									}}

									// grow on hover
									className={`
										flex flex-col items-center gap-3 p-4 bg-white rounded-lg ring-1 ring-gray-400 cursor-pointer transition-all shadow-layered-low-b
										${isBlockProDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:ring-gray-500 hover:scale-105 hover:shadow-layered-mid-b'}
										
									`}
								>
									{block.icon && (
										<div className="flex-shrink-0 text-gray-600">
											<Icon name={block.icon} size={18} />
										</div>
									)}
									<p className="flex-1 text-sm text-gray-700 cursor-pointer">
										{block.label}
									</p>
									{
										block.pro && ! isLicenseValid && (
											<div className="flex-shrink-0">
												<ProBadge label={'Pro'}/>
											</div>
										)
									}
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
								<div className="flex-shrink-0 text-gray-600">
									<Icon name={animatingBlock.block.icon} size={18} />
								</div>
							)}
							<p className="flex-1 text-sm text-gray-700">
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
