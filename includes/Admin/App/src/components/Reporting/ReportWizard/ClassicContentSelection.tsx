import { useWizardStore } from '@/store/reports/useWizardStore';
import { __ } from '@wordpress/i18n';
import FieldWrapper from '@/components/Fields/FieldWrapper';
import { useFormContext } from 'react-hook-form';
import { memo, useEffect, useRef } from 'react';
import useLicenseData from '@/hooks/useLicenseData';
import ProBadge from '@/components/Common/ProBadge';
import { useReportConfigStore } from '@/store/reports/useReportConfigStore';
import { ContentBlockId, ContentItem } from '@/store/reports/types';
import Icon from '@/utils/Icon';

/**
 * Classic content selection component.
 * Displays a grid of content blocks with checkboxes for enabling/disabling blocks.
 */
const ClassicContentSelection = () => {
	const availableContent = useReportConfigStore( ( state ) => state.availableContent );
	const content = useWizardStore( ( state ) => state.wizard.content );
	const addContent = useWizardStore( ( state ) => state.addContent );
	const removeContent = useWizardStore( ( state ) => state.removeContent );
	const shouldLoadEcommerce = window.burst_settings?.shouldLoadEcommerce || false;

	const { isPro, isLicenseValid } = useLicenseData();
	const isFirstRender = useRef( true );

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
					availableContent
						.filter( ( block ) => ! block.ecommerce || shouldLoadEcommerce )
						.filter( ( block ) => ! block.component )
						.map( ( block:ContentItem, index ) => {
							const isBlockSelected = isSelected( block.id );
							const isBlockProDisabled = block.pro && ( ! isLicenseValid || ! isPro );

							return (
								<div
									key={index}
									onClick={() => handleToggle( block )}
									className={`
										flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all
										${isBlockSelected ? 'border-brand bg-brand/5' : 'border-gray-200 hover:border-gray-300 bg-white'}
										${isBlockProDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}
									`}
								>
									{block.icon && (
										<div className={`flex-shrink-0 ${isBlockSelected ? 'text-brand' : 'text-gray-600'}`}>
											<Icon name={block.icon} size={18} />
										</div>
									)}
									<label htmlFor={block.id} className="flex-1 text-sm text-gray-700 cursor-pointer">
										{block.label}
									</label>
									{
										block.pro && ! isLicenseValid && (
											<div className="flex-shrink-0">
												<ProBadge label={'Pro'}/>
											</div>
										)
									}
									<div className="flex-shrink-0">
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
											className="h-4 w-4 text-brand border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
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
